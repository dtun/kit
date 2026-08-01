# Kit → eve: Port Plan

Status: **plan only — no implementation.** This document is the contract a build phase derives
from. It assumes [`KIT_GAP_ANALYSIS.md`](KIT_GAP_ANALYSIS.md) as the diagnosis of record and does
not restate it.

Date: 2026-08-01. Method: full read of `src/` (5,201 lines, 74 files), `test/`, `eval/`,
`wrangler.jsonc`, against the complete eve documentation set. Every eve claim below cites the doc
page it came from. Where the docs do not answer a question, this plan says **unverified** rather
than guessing.

Target: [eve](https://github.com/vercel/eve) — Apache-2.0, created 2026-06-16, **in beta**
("The framework, APIs, documentation, and behavior may change before general availability" —
*eve*, Vercel docs).

---

## 0. The gate before the port

**Nothing in §3 onward starts until the current Cloudflare deployment has produced one genuinely
useful morning digest.**

As of 2026-08-01, `https://kitkit.dev/health` returns `"calendarConfigured": false`. Issue #4 is
closed but the production secrets were never set, so the journal has never been filled by its only
automatic data source. Kit's domain model — the bullet grammar, the migration rules, the digest
assembly — has therefore never been evaluated against a non-empty journal.

That model is the **single largest thing this port carries across** (§1: ~1,478 lines survive
essentially unchanged, almost all of it domain and pure journal use-cases). Porting it before
validating it means paying the full migration cost to find out whether the thing being migrated
works.

If a filled journal still yields a useless digest, the problem is prompt and domain design. eve
does not fix that, and the port should be cancelled or deferred.

---

## 1. File-by-file disposition

Legend: **SURVIVES** = moves with import-path edits only · **REWRITTEN** = the file goes away but
its logic transfers · **DELETED** = the capability becomes the framework's job, or is dropped.

### Headline

| Disposition | Files | Lines | Share |
|---|---:|---:|---:|
| SURVIVES | 30 | 1,478 | 28% |
| REWRITTEN | 9 | 951 | 18% |
| DELETED | 35 | 2,772 | 53% |
| **Total** | **74** | **5,201** | |

**Read that honestly: just over a quarter of `src/` walks across intact.** The domain layer
survives almost whole. The application layer splits roughly in half — every use-case that takes
`ai: IAIService` or `messenger: IMessageGateway` as a dependency is rewritten or deleted, because
in eve the model and the delivery surface are the framework's, not injected ports. The adapters and
infrastructure layers are 90% deleted, which is the point: they are Cloudflare.

### `src/domain/` — 21 files, 640 lines

| File | Disposition | Becomes |
|---|---|---|
| `entities/signifier.ts` | SURVIVES | `agent/lib/domain/signifier.ts` |
| `entities/bullet-parser.ts` | SURVIVES | `agent/lib/domain/` — the bullet grammar, untouched |
| `entities/templates.ts` | SURVIVES | `agent/lib/domain/` |
| `entities/journal-path.ts` | SURVIVES | `agent/lib/domain/` |
| `entities/journal-entry.ts` | SURVIVES | `agent/lib/domain/` |
| `entities/edit-record.ts` | SURVIVES | `agent/lib/domain/` |
| `entities/archive-policy.ts` | SURVIVES | `agent/lib/domain/` |
| `entities/date-context.ts` | SURVIVES | `agent/lib/domain/` |
| `entities/digest-preferences.ts` | SURVIVES | `agent/lib/domain/` |
| `entities/migration-result.ts` | SURVIVES | `agent/lib/domain/` |
| `entities/calendar-event.ts` | SURVIVES | `agent/lib/domain/` |
| `entities/forwarded-email.ts` | SURVIVES | `agent/lib/domain/` |
| `entities/cold-start.ts` | SURVIVES | `agent/lib/domain/` — rules fold into `instructions.md` |
| `entities/family-member.ts` | SURVIVES | `agent/lib/domain/` — drop the `sms` channel variant |
| `entities/authorization.ts` | SURVIVES | `agent/lib/domain/` — called from the channel handler (§6) |
| `errors.ts` | SURVIVES | `agent/lib/domain/` |
| `entities/persona.ts` | REWRITTEN | The traits + rules become `agent/instructions.md` prose; `KIT_SIGN_OFF` stays a lib constant. `CHANNEL_TONE` dies with SMS |
| `index.ts` | REWRITTEN | Barrel re-exports change |
| `entities/intent.ts` | DELETED | The 13-way classifier retires. eve's harness *is* the router |
| `entities/kit-message.ts` | DELETED | The channel normalizes inbound and owns delivery (*Channels overview*) |
| `entities/conversation-turn.ts` | DELETED | eve sessions own conversation history (*Sessions, runs & streaming*) |

**Zero domain files import Cloudflare types.** The only edit is the `@domain/*` path alias, which
becomes a relative or `lib/`-rooted import. This is the payoff of the layering.

### `src/application/` — 26 files, 2,176 lines

**Ports**

| File | Disposition | Notes |
|---|---|---|
| `ports/journal-repository.ts` | SURVIVES | **The seam that makes §3.1 cheap.** Keep it verbatim |
| `ports/calendar-service.ts` | SURVIVES | Same |
| `ports/ai-service.ts` | DELETED | 74 lines. The whole `ToolTurnMessage`/`ToolUseRequest`/`ToolResult` protocol is what eve's harness does (*The Harness*) |
| `ports/message-gateway.ts` | DELETED | Channel owns delivery |
| `ports/conversation-store.ts` | DELETED | eve sessions |

**Use-cases that survive** (pure journal/calendar manipulation, no model, no delivery):

`append-to-log.ts` (25) · `create-daily-log.ts` (33) · `read-journal-entry.ts` (16) ·
`initialize-journal.ts` (51) · `roll-month-forward.ts` (45) · `migrate-tasks.ts` (98) ·
`build-bullet-digest.ts` (111) · `parse-forwarded-email.ts` (91) · `fetch-upcoming-events.ts` (40) ·
`sync-calendar-to-journal.ts` (54) · `create-calendar-event.ts` (67) → **631 lines** into
`agent/lib/journal/` and `agent/lib/calendar/`.

**Use-cases that do not**

| File | Lines | Disposition | Notes |
|---|---:|---|---|
| `bujo-tools.ts` | 215 | REWRITTEN | Splits into six `agent/tools/*.ts`. `BUJO_TOOL_DEFINITIONS` (Anthropic JSON Schema) → per-file `inputSchema` Zod; `createBujoToolHandlers` bodies → per-file `execute`. The `writes: string[]` bookkeeping is deleted — Agent Runs records tool calls (*Observability*) |
| `compile-status.ts` | 112 | REWRITTEN | The journal-context assembly (sections 1–5) survives as a lib function or a `journal_context` tool. The `ai.complete()` call and the system prompt move to `instructions.md` |
| `send-digest.ts` | 113 | REWRITTEN | Per-member loop moves into the schedule handler; `gateway.send` → `channel.receive` (*Chat SDK*). **Keep `buildFallbackBody`** — see risk 3 |
| `run-morning-routine.ts` | 122 | REWRITTEN | → `agent/schedules/morning-brief.ts`. Steps 1–4 stay direct lib calls; step 5 hands to the channel |
| `archive-old-entries.ts` | 70 | REWRITTEN | Drop the `ai` dependency; keep the policy |
| `process-inbound-message.ts` | **525** | **DELETED** | The largest single deletion. `authorizeSender` moves to the channel handler (§6); the forward-parse feeds the user message; the 13-case `executeIntent` switch dissolves into instructions + tools; the inbound-logging append becomes a hook or a tool call |
| `represent-in-memory.ts` | 124 | DELETED | The `MAX_TURNS` loop, message accumulation, and `runTool` error wrapping are all the harness (*The Harness*) |
| `answer-question.ts` | 53 | DELETED | "Assemble journal context, prompt a model" is a turn |
| `recall-from-journal.ts` | 45 | DELETED | Same; `search` already exists as a tool |
| `get-health.ts` | 17 | DELETED | eve serves `/eve/v1/health` (*Self-host eve*) |
| `index.ts` | 32 | REWRITTEN | Barrel |

### `src/adapters/` — 23 files, 2,275 lines

| File | Lines | Disposition | Notes |
|---|---:|---|---|
| `calendar/icloud-calendar-service.ts` | 280 | SURVIVES | `tsdav` is an ordinary Node dependency here. The `DAVClientLike` workaround and the Workers-bundling comments become moot but harmless |
| `calendar/noop-calendar-service.ts` | 31 | SURVIVES | |
| `persistence/r2-journal-repository.ts` | 108 | REWRITTEN | Structure survives; `R2Bucket` → S3 client (§3.1). **Must gain ETag compare-and-swap** (§3.1, regression) |
| `email/email-parser.ts` | 105 | REWRITTEN | The Resend adapter delivers parsed text, so `PostalMime` and `streamToBytes` go. **Keep `removeQuotedReplies` and `stripHtml`** as lib — quoted-reply stripping is kit's concern, not the adapter's |
| `durable-objects/kit-agent.ts` | 232 | DELETED | Composition root is `agent/agent.ts` + eve's runtime |
| `ai/anthropic-ai-service.ts` | 126 | DELETED | Model access is `defineAgent({ model })` |
| `ai/workers-ai-service.ts` | 96 | DELETED | §3.4 |
| `ai/node-workers-ai-service.ts` | 157 | DELETED | Existed only for eval harness parity |
| `ai/intent-prompt.ts` | 98 | DELETED | Classifier retires |
| `email/email-message-gateway.ts` | 52 | DELETED | Channel |
| `persistence/sqlite-conversation-store.ts` | 81 | DELETED | eve sessions. **Behavior change** — see §6 |
| `http/landing-page.ts` | 574 | DELETED | Not an agent concern. Ship it as a separate static page if it is wanted; do not carry it into `agent/` |
| `http/app.ts`, `http/routes/*` (6), `http/middleware/auth.ts` | 192 | DELETED | eve owns routing; route auth is *Auth & route protection* |
| `sms/*` (3 files) | 76 | DELETED | Goal #1 is email as the only channel. This is the dead surface flagged in triage |

### `src/infrastructure/` + `src/config.ts` — 3 files, 177 lines

| File | Disposition | Notes |
|---|---|---|
| `infrastructure/index.ts` (92) | DELETED | `fetch`/`email`/`scheduled` handlers are channels and schedules |
| `infrastructure/env.ts` (18) | DELETED | `process.env` (*Tools*: "Tools run in your app runtime with full access to `process.env`") |
| `config.ts` (67) | REWRITTEN | `parseFamilyMembers` + `KIT` constants survive as `agent/lib/config.ts`; `AI_MODEL`/`ANTHROPIC_MODEL` move to `agent/agent.ts`; `JOURNAL_CONFIG` survives |

### `test/` — 58 files, 403 passing tests

| Group | Disposition |
|---|---|
| `test/domain/*` (10 files) | **SURVIVES verbatim.** Pure functions, no harness coupling. Runs on plain vitest instead of `@cloudflare/vitest-pool-workers` |
| `test/application/*` — the 11 surviving use-cases | SURVIVES with import edits, using the existing in-memory fakes |
| `test/application/process-inbound-message.test.ts`, `represent-in-memory.test.ts`, `bujo-tools.test.ts`, `answer-question.test.ts`, `recall-from-journal.test.ts`, `send-digest.test.ts`, `compile-status.test.ts`, `run-morning-routine.test.ts` | DELETED or REWRITTEN alongside their subjects. `bujo-tools.test.ts` largely survives if the handler bodies stay in lib |
| `test/adapters/*` (19 files) | Mostly DELETED — they test Cloudflare adapters. `icloud-calendar-service.test.ts` survives |
| `test/integration/*` | DELETED — `@cloudflare/vitest-pool-workers` goes away. Replaced by `eve eval` against a booted server |
| `test/eval/scorers/*` (6 files) | DELETED — see below |

### `eval/` — evalite harness

**Recommendation: move to eve's built-in eval suite, and accept that the existing code is
rewritten rather than ported.**

The two harnesses grade at different levels. kit's evalite suite is unit-level: `eval/helpers/`
constructs in-memory repositories and a `NodeWorkersAIService`, then scores `classifyIntent` and
`processInboundMessage` outputs with six custom scorers. eve evals are session-level — "Evals
exercise the same HTTP surface your users hit. The runner boots (or targets) a real agent server"
(*Evals overview*). Dependency-injected fakes have no place in that model; the fixture mechanism is
`mockModel` on a dedicated fixture agent.

What transfers is the **datasets**, not the harness: `eval/datasets/intent-classification.ts`,
`forwarded-emails.ts`, and `cold-start.ts` become dataset fan-out via `defineEval` array export
(*Cases*). The six scorers are replaced by `t.check(t.reply, includes(...))`, `t.calledTool(...)`,
and `t.judge.autoevals.*` (*Assertions*, *Judge*).

Net: `evalite` and the six scorer files leave the tree; the test intent behind them survives as
`evals/*.eval.ts`. Run `eve eval --strict` in CI — this closes the gap where `eval:ci` was never
wired up.

---

## 2. Target `agent/` tree

```
kit/
├── agent/
│   ├── agent.ts                      # defineAgent: model, compaction threshold
│   ├── instructions.md               # KIT_PERSONA traits + rules + bujo representation guidance
│   ├── tools/
│   │   ├── search.ts                 # journal substring search (was bujo-tools search/recall)
│   │   ├── add_task.ts               # append an open task bullet to today's daily log
│   │   ├── add_event.ts              # append an event bullet to today's daily log
│   │   ├── add_note.ts               # append a note bullet to today's daily log
│   │   ├── add_to_future_log.ts      # append a dated entry to the future log
│   │   ├── journal_context.ts        # assemble today/week/month/future + calendar (was compile-status §1-5)
│   │   ├── calendar_view.ts          # fetchUpcomingEvents
│   │   ├── calendar_add.ts           # createCalendarEvent — approval: always()
│   │   ├── bash.ts                   # disableTool()
│   │   ├── write_file.ts             # disableTool()
│   │   ├── read_file.ts              # disableTool()
│   │   ├── glob.ts                   # disableTool()
│   │   ├── grep.ts                   # disableTool()
│   │   ├── web_fetch.ts              # disableTool()
│   │   └── agent.ts                  # disableTool() — no self-delegation needed
│   ├── channels/
│   │   └── resend.ts                 # inbound email → authorizeSender gate → send(); outbound replies
│   ├── schedules/
│   │   └── morning-brief.ts          # cron "0 14 * * *"; roll/create/sync/migrate, then receive() per member
│   ├── skills/
│   │   └── (empty at cutover — see §5)
│   └── lib/
│       ├── config.ts                 # KIT constants, parseFamilyMembers, JOURNAL_CONFIG
│       ├── domain/                   # 16 surviving domain files, verbatim
│       ├── journal/
│       │   ├── s3-journal-repository.ts   # IJournalRepository over R2's S3 API, with ETag CAS
│       │   ├── append-to-log.ts, create-daily-log.ts, read-journal-entry.ts,
│       │   ├── initialize-journal.ts, roll-month-forward.ts, migrate-tasks.ts,
│       │   ├── build-bullet-digest.ts, archive-old-entries.ts
│       │   └── ports/journal-repository.ts
│       ├── calendar/
│       │   ├── icloud-calendar-service.ts, noop-calendar-service.ts
│       │   ├── fetch-upcoming-events.ts, sync-calendar-to-journal.ts, create-calendar-event.ts
│       │   └── ports/calendar-service.ts
│       └── email/
│           ├── parse-forwarded-email.ts   # forwarded-email structure detection
│           └── clean-body.ts              # removeQuotedReplies + stripHtml, salvaged
├── evals/
│   ├── evals.config.ts               # judge model; no Braintrust reporter initially
│   ├── smoke.eval.ts                 # boots, replies, signs off
│   ├── representation.eval.ts        # forwarded email → expects several write tools
│   └── data/                         # the three salvaged datasets
├── package.json
└── (src/, wrangler.jsonc retained until cutover — §4)
```

---

## 3. Infrastructure decisions

### 3.1 Journal storage — **keep R2, reach it over the S3 API**

`IJournalRepository` (18 lines) is the seam; only `r2-journal-repository.ts` changes.

**Recommendation: keep the existing `kit-journal` R2 bucket and talk to it from Vercel with an
S3-compatible client.**

Rationale: the journal is the one irreplaceable asset and there is no data migration at all. R2
charges no egress. Critically, **both deployments read the same bucket**, which is what makes the
rollback path in §7 real rather than theoretical — a parallel eve deployment and the live worker
can run against identical state.

Trade-off: an extra long-lived credential (R2 access key id + secret) in Vercel env, cross-cloud
latency on every read (the `search()` implementation is already a brute-force scan of every object,
so this is the operation that will hurt), and you keep a Cloudflare dependency you were partly
trying to leave. The alternative — Vercel Blob — buys tighter integration at the cost of a
migration and a lossy rollback. Revisit after cutover, not during.

**Regression that must be handled in the same commit:** today a single Durable Object
(`idFromName("household")`) serializes every journal access, which is why `append()` can safely be
a naive read-modify-write (`r2-journal-repository.ts:37-43`). Vercel Functions are concurrent and
there is no such serialization. Two overlapping appends — a spouse's email arriving during the
morning brief, say — will silently lose one. **The S3 adapter must implement optimistic
concurrency**: conditional `PutObject` on the read ETag, retry on mismatch. This is not optional
polish; it is a correctness requirement created by the move.

### 3.2 Email — Cloudflare Email Routing → Resend

Recommendation: `eve add channel/chat-sdk-resend` (*Resend*), configured with `streaming: false`
(*Chat SDK*: "Set `streaming: false` for surfaces that deliver one message per turn — email").

Required setup, in order:

1. Verify a sending domain in Resend. `kitkit.dev` is currently on Cloudflare DNS with Email
   Routing active — **the two cannot both own inbound MX for the same address.** Stage on a
   subdomain (`kit@mail.kitkit.dev`) until cutover so the live worker keeps receiving.
2. Set `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `RESEND_FROM_ADDRESS` (*Resend*).
3. Point Resend's inbound webhook at `/eve/v1/resend` — the route is `{route}/{adapterName}`
   (*Chat SDK*).
4. **A durable Chat SDK state adapter.** The scaffold uses `createMemoryState()`, and the docs are
   explicit: "use a durable adapter (Redis, Upstash, etc.) in production so thread subscriptions and
   inbound deduplication survive restarts" (*Chat SDK*). This is an additional paid dependency the
   Cloudflare version did not need. Budget for it.

**What improves:** Cloudflare's `send_email` binding can only deliver to *verified Email Routing
destinations* — root cause #3 in the gap analysis, and the reason replies silently vanished. Resend
sends to arbitrary addresses. That constraint disappears entirely.

**What gets worse:** deliverability becomes kit's problem. Cloudflare Email Routing forwarding is
effectively free and pre-warmed; a new Resend domain needs SPF/DKIM/DMARC set up and has no sending
reputation.

**Sender continuity:** `kit@kitkit.dev` can remain the visible sender via `fromAddress`, so no
family-facing address changes at cutover.

### 3.3 Hosting — **Vercel-hosted, on Pro**

Self-hosting Nitro (*Self-host eve*) is viable and would preserve more control, but it requires
running a persistent Node process, proxying **both** `/eve/` and `/.well-known/workflow/` without
path rewriting ("A proxy restricted to `/eve/` lets a session start, but the run stalls when its
callback can't reach eve"), mounting `.eve/.workflow-data` on persistent storage, and ensuring the
host actually starts Nitro's scheduled-task runner — "the schedule definitions still compile, but
they will not fire automatically" otherwise. That is a homelab project, not a deployment. The whole
premise of kit is that it runs when your computer is off.

**Pro plan, not Hobby.** Vercel Hobby cron jobs are limited to "Once per day" with "Per-hour (±59
min)" scheduling precision (*Cron jobs usage & pricing*). Kit needs exactly one daily cron, so
Hobby technically qualifies — but a 7:00 AM digest would arrive anywhere between 7:00 and 7:59.
Pro gives per-minute precision. Call it a $20/month floor before usage.

Cron remains UTC (*Schedules*: "Vercel evaluates the expression in UTC"), so `0 14 * * *` stays
correct for 7 AM Arizona.

### 3.4 Model — AI Gateway string id; delete the Workers AI path

Recommendation: `model: "anthropic/claude-opus-4.8"` via AI Gateway. On Vercel this authenticates
with OIDC and needs no provider key management (*agent.ts*). Kit is already on Opus 4.8
(`config.ts:ANTHROPIC_MODEL`), so this is a like-for-like swap.

Use the direct provider (`npm install @ai-sdk/anthropic`, `model: anthropic("claude-opus-4-8")`)
only if §3.3 is reversed and kit self-hosts, where a gateway key would be needed anyway. Note the
id format differs between the two paths — `anthropic/claude-opus-4.8` for gateway,
`claude-opus-4-8` for direct.

**Delete the Workers AI path entirely — agreed.** All 351 lines of it (`workers-ai-service.ts`,
`node-workers-ai-service.ts`, `intent-prompt.ts`) exist to serve a cheap intent classifier that
this port retires, and to act as a degraded fallback. A weaker model producing a worse digest is
not a useful fallback; the *deterministic* `buildBulletDigest()` is. Keep that as the failure path
(§7, risk 3) and drop the second model.

Consider `compaction: { thresholdPercent: 0.75 }` (*agent.ts*) — a long-running email thread that
accumulates journal context will approach the window faster than a chat session.

### 3.5 Secrets

`wrangler secret put` → Vercel project environment variables, read via `process.env` from tools
(*Tools*).

| Current | After | Note |
|---|---|---|
| `FAMILY_MEMBERS` | same | JSON roster; `parseFamilyMembers` survives |
| `ANTHROPIC_API_KEY` | dropped on Vercel | AI Gateway + OIDC (§3.4) |
| `ICLOUD_APPLE_ID` / `ICLOUD_APP_PASSWORD` | same | Still an app-specific password |
| `API_KEY` | replaced | eve route auth (*Auth & route protection*) |
| `TWILIO_*` | deleted | SMS removed |
| — | `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `RESEND_FROM_ADDRESS` | new |
| — | `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT` | new (§3.1) |
| — | Chat SDK state store credentials | new (§3.2) |

Net: the secret surface grows from 7 to roughly 10. `.dev.vars` → `.env.local`; the PII-scrubbing
requirement from #17 carries over unchanged.

---

## 4. Commit plan

Conventional Commits, dependency-ordered, each independently reviewable. **The eve work happens on
a branch, deployed in parallel; the Cloudflare worker keeps serving `kit@kitkit.dev` until step 16.**

### Gate 0 — validate the domain (no eve, no branch)

| # | Commit | Verification | Effort |
|---|---|---|---|
| 1 | `feat(ops): add doctor script verifying prod secrets, bindings, and reply destinations` | `npm run doctor` against prod reports every check | 0.5d |
| 2 | *(operational, not a commit)* `wrangler secret put ICLOUD_APPLE_ID` / `ICLOUD_APP_PASSWORD`; confirm `ANTHROPIC_API_KEY` is set | `/health` shows `calendarConfigured: true` | 1h |
| 3 | `feat(health): report AI-brain readiness and last-cron outcome` | `/health` distinguishes "configured" from "last run succeeded" | 0.5d |
| 4 | *(operational)* Observe **seven consecutive** morning digests | Digests contain real calendar events and real bullets | 1w elapsed |

**Decision point.** If the digests are not useful, stop. Fix the domain and the prompts on
Cloudflare, where the iteration loop is already working. The port is not the fix.

### Phase 1 — scaffold and lift (nothing user-visible)

| # | Commit | Verification | Effort |
|---|---|---|---|
| 5 | `build(eve): scaffold eve project alongside the worker` | `eve dev` boots; `curl` a session returns a reply | 0.5d |
| 6 | `refactor(domain): remove @config alias dependency from domain layer` | 403 existing tests still green **on Cloudflare** | 0.5d |
| 7 | `feat(eve): add S3-backed journal repository with ETag compare-and-swap` | Contract tests against the real `kit-journal` bucket; a concurrent-append test proves no lost writes (§3.1) | 1.5d |
| 8 | `feat(eve): move domain and pure journal use-cases into agent/lib` | Ported unit tests pass under plain vitest | 1d |
| 9 | `feat(eve): expose the bujo tool surface as eve tools` | `eve eval` smoke asserting `t.calledTool("add_task")` | 1d |
| 10 | `feat(eve): author instructions.md from the persona and cold-start rules` | Eval checks the `- Kit` sign-off and plain-text constraint | 0.5d |
| 11 | `feat(eve): disable shell, filesystem, and web tools in the harness` | Eval asserts the model has no `bash`; see risk 5 | 0.5d |

### Phase 2 — surfaces

| # | Commit | Verification | Effort |
|---|---|---|---|
| 12 | `feat(eve): add Resend email channel with family-member authorization` | Real email from a listed address to the staging address gets a reply; an unlisted address does not (§6) | 1.5d |
| 13 | `feat(eve): port the calendar service as read tools` | `calendar_view` returns real iCloud events | 1d |
| 14 | `feat(eve): port the morning brief as a scheduled digest` | Dev dispatch route (`POST /eve/v1/dev/schedules/morning-brief`) delivers to both members | 1.5d |
| 15 | `feat(eve): gate calendar writes behind human approval` | Eval parks at `session.waiting`, `t.respond` approves, tool runs (*Human-in-the-loop*) | 1d |
| 16 | `test(eve): port eval datasets to eve evals and wire CI` | `eve eval --strict` green in CI | 1.5d |

### Phase 3 — cutover

| # | Commit | Verification | Effort |
|---|---|---|---|
| 17 | `ci(eve): deploy the eve app to a staging domain` | Parallel run for ≥7 days; both deployments read the same bucket | 0.5d |
| 18 | `chore(cutover): move kit@kitkit.dev inbound to the eve deployment` | DNS/MX change; reversible in minutes | 0.5d |
| 19 | `chore(cleanup): remove the Cloudflare worker and its adapters` | **Only after 14 days of parity.** Deletes `src/`, `wrangler.jsonc`, the CF dev deps | 0.5d |

**Total: ~15 engineering days**, plus three weeks of elapsed observation time that cannot be
compressed (steps 4, 17, 19).

---

## 5. What the framework does not answer

eve supplies the loop, the approval mechanism, the schedule, the channel, and the observability. It
supplies **no opinion about what kit should remember**. Two open issues are entirely unaffected by
this port:

**#8 — open-loop lifecycle (waiting-on / deferred / dropped + owner).** `TaskState` today is
`open | completed | migrated | scheduled | cancelled` (`signifier.ts:5`). The heart of an open-loop
tracker — "who is waiting on whom" — is absent, and `parseBulletLine` extracts a single `@person`
with no owner semantics (`bullet-parser.ts:84`). This is a domain change to files that **survive the
port unchanged**, which means it can be done before, during, or after with equal cost. It is not
blocked, and it does not block.

**#9 — family brain / household facts.** `indexTemplate()` emits static empty `## People` /
`## Collections` / `## Tags` headers that nothing ever maintains (`templates.ts:52-65`). Note that
eve's `defineState` **cannot** hold this: it is per-session and "never shared with subagents"
(*State*), and the docs are explicit that "anything that has to outlive the session, be shared
across sessions or users… belongs in an external store." The family brain must live in the journal.
That is the same design decision it is today, so again: not blocked, does not block.

**Blocked on neither:** every commit in §4. **Blocked on both:** any claim that kit is a house
manager rather than a journal. The port does not advance that claim by one inch.

**Skills.** `agent/skills/` is empty at cutover deliberately. The open question at the bottom of
#20 — what are kit's skills — is now answerable in eve's terms ("procedures the model loads when
useful", *Project Structure*), but nothing in the current codebase is a skill. Candidates after
cutover: inbox triage, reimbursement handling, travel prep. Spec separately.

**#12 / #13 printing.** eve has no local-network story. If printing matters, kody's remote-connector
pattern — a home process opening an outbound WebSocket that exposes MCP-style tools
(`kody-connectors.md`) — remains the right model, reachable from eve as a custom connection.
Unverified whether eve can consume such a connector without an MCP shim in front of it.

---

## 6. The two-person household

Kit today is one journal for two people, serialized through a single Durable Object named
`"household"`. eve has no equivalent notion. Here is how it actually maps.

**Sessions are per-thread, not per-household.** The Chat SDK channel derives the continuation token
from the Chat SDK thread: "The `thread` you pass determines the continuation token and the persisted
channel state" (*Chat SDK*). For email, `bot.onNewMention` fires on "a new inbound thread". So each
email thread is one eve session. Two spouses emailing the same address produce two independent
sessions.

**That is fine, because the journal is external.** The shared state lives in R2 behind
`IJournalRepository`, reachable identically from every session. This is the correct arrangement and
requires no work — but it does mean the ETag concurrency control in §3.1 is now load-bearing, since
two sessions can write the same daily log simultaneously.

**Authorization moves into the channel handler.** `authorizeSender` (which survives verbatim) runs
in `bot.onNewMention` before `send()` is called, and the resolved `FamilyMember` is attached as the
principal:

```
send(message.text, { thread, auth: { authenticator: "email",
                                     principalType: "user",
                                     principalId: member.contact, ... } })
```

Tools then read `ctx.session.auth.current` (*Session Context*) for attribution, replacing the
`member.name` threading that `process-inbound-message.ts` does by hand today. Unlisted senders
never reach `send()`, which reproduces the current bounce behavior at a different layer.

**Three things do not map cleanly:**

1. **Proactive digests to both members.** The schedule handler must call
   `channel.receive({ target: { adapterName: "resend", threadId: "resend:user@example.com" } })`
   once per member (*Chat SDK*, "Proactive sessions"). Whether a `threadId` of that form
   successfully opens a *new* outbound thread to an address with no prior inbound history is
   **unverified** — the docs show the shape but not that guarantee. **This is the single highest
   -risk unknown in the port**, because it is the morning digest, which is the entire product.
   Verify it in a spike before committing to step 14.

2. **Cross-spouse approval.** A tool parked on `always()` approval renders its prompt into the
   thread that triggered it. Whether the *other* spouse can approve an action the first one started
   is not modeled — approval is thread-scoped. For a household where either adult should be able to
   sign off, this is a genuine gap. **Unverified** whether `resolveInputAuth` offers a way around
   it.

3. **Conversation continuity is lost.** `SqliteConversationStore` keeps the last 50 turns per member
   across every message ever sent. eve scopes history to the thread, so a new email thread starts
   with no memory beyond what is in the journal. Arguably this is correct — the journal *is* the
   memory, and that is kit's whole thesis — but it is a behavior change and should be a conscious
   choice, not a discovery after cutover.

---

## 7. Risks

**1. eve is six weeks old and in beta.** Created 2026-06-16, commits landing daily, workflow
protocol pinned at `5.0.0-beta` with the runtime rejecting incompatible versions (*Self-host eve*).
The docs carry an explicit change warning. Mitigation: pin exact versions, keep the Cloudflare
worker deployable through step 19, and expect to re-do work when APIs move. A secondary tell — the
*Channels overview* states "eve does **not** use the Chat SDK's runtime… `Chat`, `Adapter`, and
`Thread` primitives are never imported or reachable through eve's public API," while the *Chat SDK*
page shows exactly those imports. The email channel sits precisely on that seam.

**2. Cost goes from ~$0 to a metered floor.** Today: Cloudflare free tier, free Workers AI, free
Email Routing. After: Vercel Pro ($20/mo, required for cron precision per §3.3) + Functions +
Workflows — note "Stream writes are persisted by Workflows and count toward Workflow data written
and retained" (*eve pricing*) — + Sandbox (a sandbox exists per agent "by default, with nothing to
author", *Sandbox*; **unverified** whether it bills when no sandbox tool is ever called) + AI Gateway
+ Anthropic tokens on every digest and every email + Resend + a Redis/Upstash state store. Mitigation:
Vercel Spend Management from day one; measure with Agent Runs before cutover.

**3. No free fallback.** Kit currently degrades to llama when Claude fails. After the port, a model
outage means no digest at all. Mitigation: **keep `buildBulletDigest()` and `buildFallbackBody()`**
and have the schedule handler deliver the deterministic digest if the turn fails. This is why
`send-digest.ts` is REWRITTEN rather than DELETED.

**4. New prompt-injection surface.** This one is created by the port. Kit's inputs are *forwarded
emails written by third parties* — schools, vendors, strangers. eve's default harness ships `bash`,
`read_file`, `write_file`, `glob`, `grep`, and `web_fetch`, and the docs warn: "Review these built-in
tools before production use. Disable, wrap, restrict, or require approval for any tool that can
access the filesystem, network, shell, or sensitive data" (*The Harness*). The Cloudflare version has
no shell at all. Mitigation: commit 11 disables them via `disableTool()` before the email channel
lands in commit 12 — the ordering is deliberate and must not be reversed.

**5. Printing has no eve answer** (§5). If #12/#13 are near-term priorities, this port does not
serve them.

**6. Rollback.** Through step 18 the Cloudflare worker stays deployed and functional, and both
deployments read the same R2 bucket, so state never diverges. Rolling back is an MX/DNS change plus
re-enabling Cloudflare Email Routing — minutes, no data loss. After step 19 rollback means `git
revert` of the deletion commit plus a `wrangler deploy`; still cheap, since the bucket is untouched.
**Do not run step 19 until at least 14 days of parity.**

---

## 8. What this port does not fix

- **The empty journal.** Only Gate 0 fixes that. A port on top of empty memory produces an
  identically useless digest on a more expensive platform.
- **Digest quality.** "Summarize the whole journal" (`compile-status.ts:81-99`) is a prompt design
  problem. eve moves the prompt into `instructions.md`; it does not improve it. The gap analysis's
  "smallest useful packet with one decide-this-today item" is still unwritten.
- **#8 open-loop lifecycle** and **#9 family brain** — §5.
- **#11 two iCloud accounts.** `ICloudCalendarService` survives unchanged, single-account limitation
  included.
- **#12 / #13 printing.**
- **Pattern and recurrence learning**, which `persona.ts:20` claims and no code implements.

The port buys: a real approval boundary, a real scheduler, durable sessions, an email channel that
can reach arbitrary recipients, an eval harness wired into CI, and observability that would have
surfaced the six-week outage on day one. It buys no new product behavior. Every issue that makes
kit a house manager rather than a journal remains open on the other side.
