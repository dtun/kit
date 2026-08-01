# `@paperstreetapp/bujo-cli` — Technical Specification

Status: draft, pre-implementation. Items marked `[ASSUMPTION]` are sensible defaults the author has chosen unilaterally; flag in review if any are wrong.

This document is the contract. The roadmap derives from it: each section that says "MUST" implies test cases, and each test case implies work.

---

## 1. Scope

The package is a Node 20+ CLI that implements the Bullet Journal method as a file-based memory substrate. Storage is plain Markdown files on disk. Primary users are humans at a terminal and AI agents that shell out. There is no daemon, no server, no network call, no LLM dependency.

In scope at v1:
- Daily log, monthly log, future log, index.
- Collections (topic pages outside the dated tree).
- Threading (bidirectional cross-references between bullets).
- Stable bullet IDs.
- Migration, archive (deterministic concatenation), digest.

Out of scope at v1: MCP server, importable library API, LLM-powered recall, sync, encryption, multi-user.

---

## 2. File format

### 2.1 Bullet line grammar

```
bullet      := signifier? bullet-prefix content id-suffix? newline
signifier   := ("!" | "*") " "
bullet-prefix := "- [" state "] " | "- "          ; "- " is a note
state       := " " | "x" | ">" | "<" | "-" | "o"
content     := <UTF-8 text, may contain inline tokens>
id-suffix   := " ^" id
id          := 8 chars from [a-z0-9] (Crockford base32 minus i, l, o, u)
```

Inline tokens inside `content`:

```
@<person>        ; ASCII letters, digits, underscore, hyphen
#<tag>           ; same character class as person
→ ^<id>          ; forward thread reference
← ^<id>          ; backref (written automatically by the tool, see §6.4)
```

State semantics:
- `[ ]` open task
- `[x]` completed
- `[>]` migrated forward
- `[<]` scheduled
- `[-]` cancelled
- `[o]` event
- bare `- ` (no brackets) note

Signifiers:
- `!` priority
- `*` inspiration

The signifier MUST appear at the start of the line, before `- `.

### 2.2 Examples

```
- [ ] Pay rent @Danny #bills ^a3f2k7p9
! - [ ] Sign lease @Danny → ^7k2p3xq4 ^b8m4n1r2
- [x] Reply to Sarah @Sarah #email ^c4q9w0e1
- [o] Vet appointment 3pm #pets ^d8t2y5u6
- Quote: "every system is perfectly designed" ^e1z6x3v7
```

### 2.3 ID generation

- IDs are generated from `crypto.randomBytes` and encoded as 8 lowercase Crockford base32 characters.
- Character set: `0123456789abcdefghjkmnpqrstvwxyz` (32 symbols, omits `i`/`l`/`o`/`u` to reduce confusion). [ASSUMPTION] standard Crockford set; spec it explicitly so the parser can validate.
- Collision check: on generation, the writer MUST scan the target file and any threading targets for an existing `^id` match and retry up to 3 times before failing with exit code 1.
- `^xxxxxxxx` MUST appear at the end of the line, separated by a single space. If a line lacks an ID, the parser treats the bullet as legacy/external and any mutation operation MUST assign one before persisting.

### 2.4 Threading syntax

A forward reference is written in the source bullet as `→ ^<id>` somewhere in `content`. When the tool writes a thread, it MUST also write the matching backref `← ^<source-id>` into the referenced bullet's content. Both edges are visible to humans. Removing one edge with a CLI command MUST remove the other.

Threads may cross any two pages (daily↔daily, daily↔collection, collection↔collection, monthly↔future, etc.).

[ASSUMPTION] Threads are bullet-to-bullet only at v1. Page-to-page or section-to-section threading is out of scope until 0.2.

### 2.5 Headers and templates

Daily log (`<root>/YYYY/MM/DD/daily.md`):

```
# YYYY-MM-DD <Day-of-week>

## Tasks

## Events

## Notes
```

Monthly log (`<root>/YYYY/MM/month.md`):

```
# <Month> YYYY

## Calendar

## Tasks
```

Future log (`<root>/future-log.md`):

```
# Future Log

## YYYY-MM
## YYYY-MM
## YYYY-MM
## YYYY-MM
## YYYY-MM
## YYYY-MM
```

Six months ahead, rolling. [ASSUMPTION] horizon = 6 months; configurable later.

Index (`<root>/index.md`):

```
# Index

## Daily Logs
- YYYY-MM → YYYY/MM/

## Collections
- <name> → collections/<slug>.md
```

The index MUST be rewritten on every collection create/archive and on every month roll. [ASSUMPTION] flat lists at v1; categorical grouping in 0.2.

### 2.6 Collections

Path: `<root>/collections/<slug>.md`.
Slug rules: ASCII lowercase letters, digits, hyphens. Length 1–48. Generated from the user-supplied name by lowercasing, replacing whitespace with `-`, and stripping disallowed chars. Collisions are resolved by appending `-2`, `-3`, etc.

Header:

```
# <name>

<freeform body, bullets allowed>
```

---

## 3. Directory layout

```
<journal-root>/
  index.md
  future-log.md
  collections/
    <slug>.md
  YYYY/
    MM/
      month.md
      DD/
        daily.md
        edits.log
```

- All `YYYY`, `MM`, `DD` segments are zero-padded.
- `edits.log` is one JSON object per line, append-only, internal only.
- `collections/` is created on first collection.
- The root MUST contain at minimum `index.md`, `future-log.md`, and the current month's `month.md` after `bujo init`.

---

## 4. Domain model

```ts
type BulletType = "task" | "event" | "note";
type TaskState = "open" | "completed" | "migrated" | "scheduled" | "cancelled";
type Signifier = "priority" | "inspiration";

interface BulletEntry {
  id: string;                // 8-char base32, REQUIRED on persisted bullets
  type: BulletType;
  state?: TaskState;          // present iff type === "task"
  signifier?: Signifier;
  content: string;            // raw text WITHOUT id suffix; may contain inline tokens
  people: string[];           // extracted from @-mentions
  tags: string[];             // extracted from #-tags
  forwardRefs: string[];      // ids appearing after →
  backRefs: string[];         // ids appearing after ←
}

interface JournalEntry {
  path: string;               // relative to root, e.g. "2026/05/09/daily.md"
  content: string;            // raw file contents
  lastModified: Date;
}

interface EditRecord {
  timestamp: string;          // ISO 8601
  action: "create" | "update" | "migrate" | "archive" | "delete" | "thread" | "unthread";
  path: string;
  reason?: string;
  diff?: string;              // optional, omitted for size on large edits
}

interface MigrationResult {
  source: string;
  destination: string;
  migrated: BulletEntry[];
  cancelled: BulletEntry[];
  reviewedCount: number;
}

interface Collection {
  slug: string;
  name: string;
  createdAt: string;
  archivedAt?: string;
}
```

Pure parser surface:

```ts
parseBulletLine(line: string): BulletEntry | null;
serializeBullet(entry: BulletEntry): string;          // round-trip
extractIds(line: string): { id?: string; forwardRefs: string[]; backRefs: string[] };
generateId(): string;
```

`parseBulletLine` MUST return `null` for non-bullet lines (headers, blank lines, freeform text), never throw.

---

## 5. Repository port

```ts
interface IJournalRepository {
  read(path: string): Promise<JournalEntry>;
  write(path: string, content: string, reason?: string): Promise<void>;
  append(path: string, content: string, reason?: string): Promise<void>;
  delete(path: string, reason?: string): Promise<void>;
  list(prefix: string): Promise<string[]>;
  exists(path: string): Promise<boolean>;
  search(query: string, prefix?: string): Promise<JournalEntry[]>;  // naive substring
  getEditLog(path: string): Promise<EditRecord[]>;
}
```

Contract:
- All paths are POSIX-style relative to the journal root, regardless of OS.
- `write` is atomic (temp file + rename).
- `append` is atomic w.r.t. concurrent writers (lockfile, see §6).
- `read` MUST throw `EntryNotFound` for missing files; never return `null`.
- `search` returns matches whose content contains `query` (case-insensitive [ASSUMPTION]).
- `getEditLog` returns entries in chronological order.

Two implementations ship at v1:
- `FilesystemJournalRepository` — production.
- `InMemoryJournalRepository` — exported under `/testing` subpath for consumer tests.

---

## 6. Filesystem adapter

### 6.1 Atomic writes
Every `write` and `append` MUST:
1. Acquire `proper-lockfile` lock on the target path with 5s timeout.
2. Write to a temp file in the same directory.
3. `fsync` the temp file.
4. Rename over the target.
5. Append an `EditRecord` to `edits.log` in the target's directory.
6. Release the lock.

### 6.2 Lock contention
On lock timeout, throw `LockContention`. CLI maps to exit code 4.

### 6.3 Edit log format
One JSON object per line, schema:

```json
{"timestamp":"2026-05-09T14:32:11.412Z","action":"update","path":"2026/05/09/daily.md","reason":"add task"}
```

Format is internal; not part of the public contract; may change at any patch version.

### 6.4 Threading writes
`thread <source-id> <target-id>`:
1. Locate source and target files via `list` + parse scan.
2. Append `→ ^<target-id>` to source content (before the source's own `^id`).
3. Append `← ^<source-id>` to target content.
4. Both edits MUST succeed or the operation MUST be rolled back.
5. Two `EditRecord`s are written, both with `action: "thread"` and a shared `txn` field. [ASSUMPTION] add `txn` field to `EditRecord` for atomicity tracking.

`unthread` is the same in reverse; both edges removed or none.

### 6.5 Cross-platform
- Paths normalized to forward slashes on input/output regardless of OS.
- Newlines: write `\n` on all platforms; tolerate `\r\n` on read.
- File extension is always `.md`.
- The CI matrix MUST include `windows-latest`.

---

## 7. CLI surface

Every command supports `--journal-dir <path>` and `--json`. Date arguments accept `YYYY-MM-DD` only.

### 7.1 Commands

| Command | Purpose | Mutates |
|---|---|---|
| `bujo init` | Create root, index, future-log, current month, current day. Idempotent. | yes |
| `bujo daily [--date <d>]` | Ensure today's daily log exists; print path. | maybe |
| `bujo add <content> [--priority\|-p] [--inspiration\|-i] [--person <n>] [--tag <t>] [--date <d>]` | Append a task to a daily log. | yes |
| `bujo event <content> [...]` | Append a `[o]` event. | yes |
| `bujo note <content> [...]` | Append a note. | yes |
| `bujo done <id>` | Mark task `[x]`. | yes |
| `bujo cancel <id>` | Mark task `[-]`. | yes |
| `bujo schedule <id> <date>` | Mark `[<]` and append a `[ ]` to target date. | yes |
| `bujo migrate --from <date> --to <date>` | Move open tasks; mark source `[>]`; create entries on target. | yes |
| `bujo archive [--now <date>]` | Concatenate eligible dailies into `month.md`; delete dailies. | yes |
| `bujo roll-month [--date <d>]` | Idempotent month/future-log refresh. | maybe |
| `bujo digest [--date <d>]` | Read-only Markdown digest: today + week-ahead + overdue. | no |
| `bujo read <id-or-path>` | Read by bullet ID or relative path. | no |
| `bujo search <query>` | Substring search across the tree. | no |
| `bujo tree` | Print the directory tree. | no |
| `bujo collection new <name>` | Create `collections/<slug>.md`; update index. | yes |
| `bujo collection add <slug> <content> [--priority\|...]` | Append bullet to a collection. | yes |
| `bujo collection archive <slug>` | Mark collection archived; update index. | yes |
| `bujo collection list` | List active and archived collections. | no |
| `bujo thread <source-id> <target-id>` | Create bidirectional thread. | yes |
| `bujo unthread <source-id> <target-id>` | Remove thread. | yes |
| `bujo refs <id>` | List forward/back references for a bullet. | no |
| `bujo doctor` | Validate journal: orphaned refs, duplicate IDs, malformed bullets. | no |

### 7.2 Bullet lookup by ID

Every mutation that takes `<id>` MUST resolve the ID by scanning the entire journal. Performance budget: linear in file count, target <500ms for 10k files. Cache on disk is out of scope at v1.

### 7.3 Exit codes

| Code | Meaning |
|---|---|
| 0 | Success |
| 1 | Generic runtime error |
| 2 | Invalid usage (bad args) |
| 3 | Not found (path or ID) |
| 4 | Lock contention |
| 5 | Validation failure (`doctor` only) |

### 7.4 stdout / stderr conventions

- Human output goes to stdout, default-formatted Markdown.
- `--json` redirects stdout to:
  ```json
  { "version": 1, "data": <command-specific> }
  ```
- Errors go to stderr, prefixed `error: ` in human mode, JSON `{ "version": 1, "error": { "code": "...", "message": "..." } }` in `--json` mode.
- No ANSI color when `NO_COLOR` is set or stdout is not a TTY.

### 7.5 Per-command JSON shapes

`add` / `event` / `note`:
```json
{ "version": 1, "data": { "id": "a3f2k7p9", "path": "2026/05/09/daily.md", "line": 7 } }
```

`done` / `cancel`:
```json
{ "version": 1, "data": { "id": "a3f2k7p9", "previousState": "open", "newState": "completed" } }
```

`migrate`:
```json
{ "version": 1, "data": {
  "source": "2026/05/08/daily.md",
  "destination": "2026/05/09/daily.md",
  "migrated": [{"id":"...", "content":"..."}],
  "cancelled": []
} }
```

`digest`:
```json
{ "version": 1, "data": {
  "date": "2026-05-09",
  "today": [...bullets],
  "weekAhead": [...],
  "overdue": [...]
} }
```

`thread` / `unthread`:
```json
{ "version": 1, "data": { "source": "a3f2k7p9", "target": "b8m4n1r2" } }
```

`doctor`:
```json
{ "version": 1, "data": {
  "duplicateIds": [],
  "orphanedRefs": [{"from":"a3f2k7p9","to":"missing"}],
  "malformedLines": [{"path":"2026/05/09/daily.md","line":12,"line_content":"..."}]
} }
```

The shapes above are version 1 of the public JSON contract. Breaking changes require a `version` bump and a migration note.

---

## 8. Configuration

Resolution order (first match wins):
1. `--journal-dir <path>` flag
2. `BUJO_HOME` env var
3. `./bujo/` if it exists in CWD
4. `~/.bujo/`

Other env vars:
- `BUJO_TZ` — IANA zone name; overrides system local time.
- `NO_COLOR` — disables ANSI color in human output.

The chosen root MUST be written to a debug log line emitted by every command when `BUJO_DEBUG=1`.

---

## 9. Locking and concurrency

- `proper-lockfile` per file, 5s timeout, retry with exponential backoff.
- Multi-file operations (migrate, thread, archive) acquire locks in canonical order: alphabetical by relative path. This prevents deadlock between concurrent invocations.
- Lock files live in the OS temp dir, not the journal, so the journal stays clean.
- An invocation that holds a lock for >2s emits a warning to stderr at the end.

---

## 10. Versioning

- SemVer. Start at `0.1.0`.
- Pre-1.0:
  - Minor (`0.x.0`) MAY include breaking CLI flag/JSON-shape changes. Each MUST appear in CHANGELOG with a migration note.
  - Patch (`0.x.y`) MUST be bugfix-only.
- 1.0.0 requires:
  1. CLI surface frozen for 60 days.
  2. JSON `version` field at 1, schema documented.
  3. At least one external consumer.
- Changesets is the source of truth. Every PR that touches public surface MUST include a changeset; CI blocks merge without one.

---

## 11. Test contract

Required test categories:

| Category | Location | Notes |
|---|---|---|
| Domain unit | `test/domain/**` | Pure, no I/O. Property-based via `fast-check` for parser round-trip. |
| Application unit | `test/application/**` | Use-cases against `InMemoryJournalRepository`. |
| Filesystem integration | `test/adapters/filesystem.test.ts` | Spawns tmp dirs, exercises locking. |
| CLI integration | `test/cli/**` | Spawns the built binary via `tinyexec`; asserts exit code, stdout, stderr. |
| Cross-platform smoke | CI matrix | `ubuntu-latest`, `macos-latest`, `windows-latest` × Node `20`, `22`. |
| Doctor scenarios | `test/cli/doctor.test.ts` | Each `doctor` failure mode has a fixture and a test. |

Coverage thresholds enforced in CI:
- `src/domain/**` ≥ 90% lines
- `src/application/**` ≥ 90% lines
- `src/adapters/**` ≥ 80% lines
- `src/cli/**` ≥ 80% lines

CI fails below threshold. No exceptions, no per-file overrides.

---

## 12. Skill contract

`skills/bujo/SKILL.md` MUST contain:
- One-paragraph trigger description.
- A "When to consult" section: at session start (`bujo digest`), before claiming "I don't remember" (`bujo search`), before scheduling work (`bujo daily`).
- A "When to write" section: at end of session (`bujo add`/`event`/`note`), when a decision is made, when migrating tasks.
- A "What to write" section: one decision per bullet, `@`-mention people, `#`-tag retrievable topics, use `!` priority sparingly.
- Working examples for every CLI command listed in §7.1.
- An explicit instruction not to dump the entire journal into context — read the digest, then issue targeted `read`/`search` calls.

A CI smoke test MUST execute every example command in `SKILL.md` against a fixture journal and assert exit 0.

---

## 13. Validation rules (`bujo doctor`)

`bujo doctor` MUST detect and report:
- Bullets without IDs (after `init`'s grace period of one run).
- Duplicate IDs anywhere in the tree.
- Orphaned forward/back refs (target ID does not exist).
- Asymmetric threads (one edge present, the other missing).
- Malformed bullet lines (matched by the bullet prefix regex but failing `parseBulletLine`).
- Collections referenced by `index.md` that don't exist on disk.
- Files with no `lastModified` in the OS that's older than `archiveAfterDays` and not yet archived.

`doctor --fix` (out of scope at v1) would auto-repair the first three. Document as a 0.2 candidate.

---

## 14. Open questions for review

- Threading at v1 is bullet-to-bullet only. Page-level threads (referencing a whole collection or daily) are deferred. Confirm.
- `archiveAfterDays` default. Kit uses 60. [ASSUMPTION] keep 60. Configurable via `--archive-after` flag on the `archive` command.
- ID character set (Crockford base32 minus `i`/`l`/`o`/`u`). [ASSUMPTION]; an alternative is base36 (full alphanumeric) for simpler parsing.
- Whether `bujo read <id>` returns just the bullet line or the full file context (e.g., 5 lines around it). [ASSUMPTION] full file at v1; bullet-only via `--bullet-only`.
- Whether `bujo search` should match across IDs (i.e. searching `a3f2k7p9` finds the bullet with that ID). [ASSUMPTION] yes; IDs are part of file content.
- Whether collections support nested folders (`collections/work/<slug>.md`). [ASSUMPTION] flat at v1.

---

## 15. Out-of-scope items, named for the roadmap

- MCP server. Adds zero-startup-cost agent integration. Candidate for 0.3.
- Importable library API. Once v1 ships, the CLI's underlying use-cases can be re-exported as a typed module surface. Candidate for 0.3.
- LLM-powered recall. Requires injectable client, key handling, prompt evals. Candidate for 0.4 if there is a real consumer.
- Semantic search / embeddings. Requires a vector store; out of scope indefinitely without a concrete need.
- Sync. Out of scope; users use Git or Dropbox.
- Multi-user, ACLs, encryption. Out of scope.

---

## Appendix A: Roadmap derivation hints

A roadmap built from this spec should be structured by section, not by chronology. Phase boundaries fall naturally at:

1. §2 + §4 (parser + domain) — pure, fast, fully testable in isolation.
2. §5 + §6 (port + filesystem adapter) — adds I/O and locking.
3. §7 (CLI) — adds user-facing surface; depends on 1 and 2.
4. §11 + §12 (test gates + skill) — depends on 3.
5. §13 (`doctor`) — depends on 3; can land late in v1.

Items inside each section are mostly parallelizable. The serial path is parser → port → filesystem adapter → CLI scaffolding → individual commands → doctor → skill.
