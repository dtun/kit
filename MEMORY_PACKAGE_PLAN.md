# Plan: Extracting Kit's Memory System into a Standalone Package

## 1. Concept and scope

Build an open-source TypeScript/npm package that implements the Bullet Journal method as a file-based memory substrate. Deliverable at v1 is a CLI, installable via `npm install -g <name>` or invokable via `npx <name>`. Primary consumers are humans at a terminal and AI agents that shell out. Underlying storage is plain text/Markdown files on disk, so the journal is inspectable and editable without the tool.

What is explicitly out of scope for v1:
- MCP server, importable library API surface, language bindings other than TS.
- Any LLM-dependent behavior (recall synthesis, archive summarization, status compilation). Those require injectable credentials and network, which turn a self-contained utility into a configured system. Revisit at v2 if/when there is a concrete consumer.
- Multi-tenancy, remote storage, sync, encryption.
- Full Ryder Carroll Bullet Journal parity (see §3).

The package is a lift of Kit's `domain/` and `application/` layers plus a new filesystem adapter and a CLI. It is not a rewrite.

## 2. Extraction scope from Kit

Lift with minor edits:
- `src/domain/entities/bullet-parser.ts`, `signifier.ts`, `journal-entry.ts`, `journal-path.ts`, `templates.ts`, `edit-record.ts`, `migration-result.ts`, `date-context.ts`.
- `src/domain/entities/archive-policy.ts` with the `JOURNAL_CONFIG` import removed in favor of a constructor-injected config object.
- `src/application/ports/journal-repository.ts`.
- Deterministic use-cases: `create-daily-log`, `append-to-log`, `read-journal-entry`, `migrate-tasks`, `roll-month-forward`, `initialize-journal`, `build-bullet-digest`.
- `InMemoryJournalRepository` from `test/helpers/mocks.ts` becomes a first-class test utility, exported under a `/testing` subpath.
- Matching tests (~50–60) ported directly.

Drop or rewrite:
- `recall-from-journal`, `compile-status` — drop, require LLM.
- `archive-old-entries` — rewrite without AI summarization. Archive becomes a deterministic "concatenate the daily logs from month X into `month.txt`, then delete the dailies" operation. This loses semantic compression but preserves the human-readable contract.
- `R2JournalRepository` — replace with a new `FilesystemJournalRepository`.
- Anything referencing `KIT_PERSONA`, `FamilyMember`, Twilio, calendar services, email gateways, Workers AI.

Add:
- `FilesystemJournalRepository` implementing `IJournalRepository` against a root directory.
- Advisory file locking (`proper-lockfile` or equivalent) around writes and append operations.
- CLI entry point (framework choice in §5).
- Config resolution: precedence `--journal-dir` flag > `BUJO_HOME` env var > `./journal/` in CWD > `~/.bujo/`. Document exactly this order and write tests for it.

## 3. Bullet Journal coverage — be honest about the gap

Kit implements: daily log, monthly log, future log, index, signifiers (`!`, `*`, `@person`, `#tag`), task states (open/completed/migrated/scheduled/cancelled), events, notes, migration.

Kit does not implement: collections (topic pages), threading (cross-page references), the formal index as a live navigation structure (Kit's index is a template, not a maintained index of collections). These are core to Ryder Carroll's method.

Decision: do not market this as a "complete" Bullet Journal implementation. README should say it implements "the daily/monthly/future-log subset of the Bullet Journal method, with signifiers and task migration." Collections and threading can land in a v0.x minor as additive features — spec them separately so the claim in marketing and the feature set in code stay aligned.

## 4. Filesystem layout and human-readability

Kit stores files with `.txt` extension. Change to `.md` in the extracted package. Rationale: every modern editor and GitHub render Markdown natively; humans are the primary audience for readability; Kit's own templates already use Markdown headings (`## Tasks`, `## Events`, `## Notes`). This is a one-line change in `templates.ts` and `journal-path.ts`.

Proposed layout (identical to Kit otherwise):

```
<journal-root>/
  index.md
  future-log.md
  YYYY/
    MM/
      month.md
      DD/
        daily.md
        edits.log          # internal; not part of the human contract
```

Line-level bullet format is unchanged: `- [ ] task`, `- [x] done`, `- [>] migrated`, `- [<] scheduled`, `- [-] cancelled`, `- [o] event`, `- note`, with optional leading `!` or `*`, and inline `@person` / `#tag`.

## 5. Architecture

Keep Kit's Clean Architecture boundaries verbatim: `domain → application → adapters → infrastructure`. Path aliases carry over.

Layers in the new package:
- `src/domain/` — pure types and parsers (no I/O, no deps).
- `src/application/` — use-cases against the `IJournalRepository` port.
- `src/adapters/persistence/filesystem-journal-repository.ts` — sole Node-fs dep.
- `src/adapters/cli/` — command definitions, argument parsing, stdout formatting.
- `src/infrastructure/` — composition root for the CLI binary.

CLI framework: **cac** or **commander**. Cac is already in Kit's `node_modules` transitively (via Vitest) and has a smaller API surface. Commander is more widely known. Pick one on day one and do not switch later.

Single package, not a monorepo. Monorepo is overhead for one library. If an MCP server or language bindings land later, convert to a pnpm/bun workspace then, not now.

## 6. CLI surface (v1)

The command verbs map 1:1 to use-cases. All commands accept `--journal-dir`, `--json` (machine-readable output), and `--date YYYY-MM-DD` where date context matters.

```
bujo init                            # create index, future-log, current month
bujo daily [--date]                  # ensure today's daily log exists, print path
bujo add <content> [--priority] [--inspiration] [--person <name>] [--tag <tag>]
bujo event <content>                 # shortcut for a `[o]` event
bujo note <content>                  # shortcut for a `-` note
bujo done <bullet-ref>               # mark task completed
bujo cancel <bullet-ref>
bujo schedule <bullet-ref> <date>
bujo migrate --from <date> --to <date>  # forward open tasks
bujo archive [--now <date>]          # deterministic monthly roll-up
bujo roll-month [--date]             # create monthly + refresh future log on 1st
bujo digest [--date]                 # today + week-ahead + overdue, prints Markdown
bujo read <path>                     # print one entry
bujo search <query>                  # naive content grep across the tree
bujo tree                            # show journal structure
```

`<bullet-ref>` is the open question in §8. The simplest initial answer: `YYYY-MM-DD:<line-number>`. Revisit before v0.2.

Exit codes: `0` success, `1` generic error, `2` invalid usage, `3` not found, `4` lock contention. Document in the README.

## 7. Test coverage and quality gates

Non-negotiables, enforced in CI:
- Vitest with separate `unit` and `integration` projects (mirror Kit's split).
- Coverage thresholds: ≥90% lines for `domain/` and `application/`, ≥80% for `adapters/`. Fail CI below threshold.
- `FilesystemJournalRepository` has integration tests using `tmp` or `os.tmpdir()`.
- CLI has integration tests that spawn the compiled binary (via `tinyexec` or Node's `child_process`), assert on exit code and stdout. Not just tests of the handler functions.
- CI matrix: `ubuntu-latest`, `macos-latest`, `windows-latest` × Node `20` and `22`. Windows is where path and newline assumptions break — don't skip it.
- `biome` (Kit already uses it) for lint/format.
- `tsc --noEmit` on every push.
- Pre-publish hook that runs the entire matrix locally via `act` or equivalent — optional but worth it.

Property-based tests for `bullet-parser`: generate random bullet entries, serialize, parse, assert round-trip equality. One `fast-check` suite catches whole classes of regression that example-based tests miss.

## 8. Versioning and release

SemVer. Start at `0.1.0`. 1.0 is deferred until:
1. The CLI command surface has been through at least one round of external use.
2. The filesystem layout is committed to (no more moving from `.txt` to `.md`, no more renaming directories).
3. There is a documented deprecation policy.

Use **Changesets** (`@changesets/cli`) for version bumps and changelog generation. Every PR that changes public surface must include a changeset file. CI blocks merge without one.

Pre-1.0 policy, written explicitly in CONTRIBUTING.md:
- Minor bumps (`0.x.0`) may include breaking CLI-surface changes. Every break must be enumerated in CHANGELOG with a migration note.
- Patch bumps (`0.x.y`) are bugfix-only, never touch public surface.

Distribution: npm, publicly scoped (e.g. `@dtunney/bujo`) or unscoped (`bujo` if available). Publish via `npm publish --provenance` from GitHub Actions so provenance attestation lands in the registry.

## 9. Agent integration via Claude Skill

Ship a `skills/bujo/SKILL.md` inside the package. The Skill file documents:
- When the agent should consult the journal (start of session, before claiming "I don't remember", at end of session to log decisions).
- The exact CLI commands the agent should use, with expected output shapes.
- A rule that the agent reads the digest first, then issues targeted `read` / `search` calls, rather than dumping the whole journal into context.
- A contract for what the agent is expected to write: one bullet per decision, use `#`-tags for retrievability, use `@`-mentions for people, use priority `!` sparingly.

The Skill is a text file, not code. It does not have its own tests, but the examples in it must be exercised by a smoke test in CI that runs each example command against a fixture journal and asserts the output parses.

## 10. Milestones

| Phase | Duration | Output |
|-------|----------|--------|
| 0. Extraction prep | 1–2 days | New repo, kit domain+application copied in, LLM use-cases removed, `JOURNAL_CONFIG` decoupled, tests still passing against `InMemoryJournalRepository`. |
| 1. Filesystem adapter | 2–3 days | `FilesystemJournalRepository`, locking, integration tests against `tmpdir`, all kit tests green on both repos. |
| 2. CLI | 3–5 days | All §6 commands wired, `--json` flag, exit codes, CLI integration tests. |
| 3. Quality gates | 2–3 days | CI matrix, coverage thresholds, Changesets, README, CONTRIBUTING, LICENSE. First publish to npm as `0.1.0`. |
| 4. Skill | 1 day | `skills/bujo/SKILL.md`, smoke test that executes its examples. |
| 5. Dogfood | open | Wire a Claude Code / Cowork session to use the CLI. Log defects as issues. Do not tag 1.0 until this has sat for at least two weeks of real use. |

Total to publishable `0.1.0`: ~10 working days assuming no surprises on Windows. Windows will have surprises.

## 11. Risks, called out honestly

- **Startup latency**. Node cold-start is 150–300ms per CLI invocation. An agent issuing 20 commands per turn pays 3–6 seconds in process overhead. This is intrinsic to the CLI-only choice and not fixable without adding an MCP server. Document it as a known limit. Plan MCP for v0.3 if dogfooding reveals it matters.
- **Concurrency**. Two processes appending to `daily.md` simultaneously will corrupt output without locking. `proper-lockfile` with a 5s timeout is adequate for single-user, single-machine. Cross-machine or cloud storage is out of scope.
- **Human edits during writes**. If a person has `daily.md` open in an editor while the CLI writes, the outcome depends on whether the editor uses atomic rename-on-save (VS Code does, many don't). Document the risk; don't try to solve it.
- **Parsing tolerance**. Humans will write malformed bullets. The parser must never throw on a stray line — it returns `null` from `parseBulletLine` and the read path treats non-bullets as passthrough content. Confirm this is Kit's current behavior and add a regression test.
- **BuJo branding**. Over-claiming parity with Ryder Carroll's method invites criticism from the BuJo community. Under-claim; document the subset explicitly.
- **npm name squatting**. Check name availability on npm immediately. "bujo" is probably taken.

## 12. Key decisions to make up front

These are the forks that will bite if deferred. Decide each before writing code.

1. **Package name and npm availability.** Check the registry. Reserve `@dtunney/bujo` if the unscoped name is gone.
2. **License.** MIT is the default for broad adoption. Apache-2.0 if you want an explicit patent grant. Pick one and commit.
3. **File extension for journal entries.** `.md` (recommended, see §4) vs. `.txt` (Kit's current choice). Affects every path constant and template.
4. **Journal root resolution order.** The §2 proposal (`--journal-dir` > `BUJO_HOME` > `./journal/` > `~/.bujo/`) is a recommendation. Pin it before the first CLI test is written.
5. **Bullet addressing scheme for `done`/`cancel`/`schedule`.** `YYYY-MM-DD:<line>` is the minimum viable. Content-hash or a stable ID written into the bullet are alternatives. Pick one before exposing mutation commands.
6. **Archive semantics without an LLM.** Plain concatenation of dailies into `month.md` vs. a structured rollup that groups by type (tasks/events/notes). The second is slightly more work and noticeably more useful.
7. **Timezone policy.** System local time vs. UTC vs. configurable. "Local" is the human-friendly answer; agents in a container may have no configured timezone. Default to local with an override env var.
8. **Edit log status.** Is `edits.log` part of the public contract (documented, versioned, stable format) or internal bookkeeping (can change at any patch version)? Strongly recommend internal.
9. **CLI framework.** `cac` vs. `commander`. No reason to delay this; pick before the first command lands.
10. **Output format for `--json`.** Define a stable JSON shape per command, versioned as `{"version": 1, ...}`. Agents will depend on it; breaking it silently is the worst possible outcome.
11. **Version bump policy for CLI flag changes.** Treat flag removals as breaking (pre-1.0 minor bump); flag additions as non-breaking (patch bump). Write it down.
12. **Scope of Ryder Carroll parity.** Commit to daily/monthly/future-log only at v1, or add collections + threading before tagging 0.1. Affects the roadmap by a week or more.
13. **Claude Skill delivery.** Shipped inside the npm package (`skills/bujo/SKILL.md`) vs. published as a separate Claude plugin. Ship inside the package for v0.1; extract to a plugin only if there's demand.
14. **Coverage threshold numbers.** 90/80 is my recommendation. Fine to raise; do not lower. Decide before the CI config is written, not after.
15. **Supported Node versions.** 20 LTS and 22 LTS only. Drop 18. Document the matrix in `package.json` `engines` field and enforce it.

## 13. What this plan does not commit to

- The exact public TypeScript API, because v1 is CLI-only. A library API surface is a v0.2+ decision driven by a real consumer.
- MCP server design. Same reason.
- Multi-agent coordination, sync, or collaboration. Out of scope indefinitely unless a specific use case justifies it.
- LLM-powered recall. Out of scope for v1; revisit when there is a concrete consumer and a decision on vendor coupling.
