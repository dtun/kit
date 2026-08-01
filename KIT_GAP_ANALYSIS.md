# Kit: Gap Analysis & Diagnosis of Record

Status: **diagnosis only — no implementation.** This document captures why kit currently
fails, the gap between kit and the AI house-manager vision, and the agreed target architecture.
It is the contract a later build phase derives from.

Date: 2026-06-20. Method: 7 parallel research agents traced each subsystem end-to-end against
the owner's six requirements and the two reported symptoms. File:line refs below are from that
trace and are the starting points for any fix.

---

## 0. The owner's goals

1. Email as the **only** communication channel between the owner, his wife, and kit.
2. A **receipt printer** and a **home printer** should both work.
3. Kit should be **independently deployable**.
4. Kit should **read the existing iCloud calendar**.
5. Kit should **use the bujo memory system** the owner built.
6. Bonus: expose an **MCP server** so the Claude chat app can connect via connectors.

Reported symptoms:
- "All I get is a daily email with nothing." → Clarified: the email is **useless**, not blank —
  it renders an empty bujo template with no real information.
- "When I email it, it fails."

---

## 1. Root-cause diagnosis

### 1.1 The one root cause

Kit was built **action-first**. The source briefing's central lesson is **"start with memory."**
Kit's memory substrate is real and well-engineered — but it is **never filled**, and the one
data source that would fill it automatically (the calendar) is **switched off**. Everything
below is a consequence of that.

### 1.2 Symptom — "useless daily email" (empty bujo template)

The email is faithfully rendering an **empty journal**. Not a formatting bug.

- Body = a fallback header line + `buildBulletDigest()`. The digest only ever has the empty
  daily-log template (`## Tasks / ## Events / ## Notes`, nothing under them) to show.
  - `build-bullet-digest.ts:78` → returns `""` when no readable entries.
  - `send-digest.ts:43-98` → assembles body from `compileStatus()` output + bullet digest.
- **Calendar never syncs in.** No `ICLOUD_*` secrets → `NoOpCalendarService` → zero events
  written each morning (`kit-agent.ts:23-27`). This is the only *automatic* data source, and
  it is off. `noop-calendar-service.ts` `fetchEvents` returns `[]`.
- **The only other inflow — emailing kit facts — is also failing** (§1.3), so the journal stays
  at the empty template indefinitely.
- **The digest model fails or is too weak.** `compileStatus` is entirely a Workers AI call
  (`compile-status.ts:99`) using `@cf/meta/llama-4-scout-17b-16e-instruct` (`config.ts:23`).
  - On AI error or empty response, `WorkersAIService.complete()` throws
    (`workers-ai-service.ts:28-42`) → caught at `send-digest.ts:54` → two-line fallback header
    (`send-digest.ts:96-98`). Diagnostic: `DIGEST_FALLBACK_USED` in `wrangler tail`.
  - If the model returns a structured *object*, `complete()` returns `JSON.stringify(response)`
    (`workers-ai-service.ts:35-37`) → email body becomes raw JSON. Also "useless."

**Most likely:** every morning falls to the fallback header over an empty journal skeleton =
"useless email." Confirm with `DIGEST_FALLBACK_USED` and the `scheduled()` result log
(`index.ts:55`).

### 1.3 Symptom — "when I email it, it fails"

The `email()` handler exists and is structurally correct (`index.ts:13-40`). It fails at the
edges, ranked by likelihood:

1. **Exact-match sender auth.** `authorizeSender` (`authorization.ts:9-25`) matches the From
   address by case-insensitive *exact equality* against `FAMILY_MEMBERS` contacts
   (the owner's `dtun@me.com`, plus a partner's iCloud address). Email from any other address
   (e.g. `danny@tunney.dev`)
   → `message.setReject("Not authorized")` (`index.ts:17-19`) → bounce.
2. **`FAMILY_MEMBERS` unset/malformed in prod.** `parseFamilyMembers` does
   `FamilyMemberSchema.parse(JSON.parse(raw))` (`config.ts:12-14`). If the secret is missing in
   production it throws at `index.ts:15` *before* the try/catch → delivery failure. Set in
   `.dev.vars` for local dev only — easy to have missed `wrangler secret put` in prod.
3. **Reply requires a verified Email Routing destination.** Cloudflare's `send_email` binding
   can only send *to* verified addresses. `EmailMessageGateway.send` sends from `kit@kitkit.dev`
   to the original sender (`email-message-gateway.ts:24-31`, `config.ts:18-19`). If the sender
   isn't a verified destination, `send()` throws → caught at `kit-agent.ts:175` → DO returns
   500, which the worker's `email()` handler **discards** (`index.ts:29` awaits but ignores
   status). Inbound is processed; reply silently never arrives.
4. **Missing/misbound `JOURNAL` R2 or `AI` binding** → throws inside the DO → swallowed as 500 →
   silent no-reply.

Note: any downstream DO error becomes a swallowed 500 with **no bounce and no reply**, so this
is undiagnosable without `wrangler tail`. The `console.error`/`console.log` at `index.ts` and
`kit-agent.ts:173,176` disambiguate auth-reject vs. DO-500 vs. send-failure.

Dead/secondary code: `email-reply.ts` (raw-MIME `buildReplyEmail`) is unused; the gateway uses
the SDK builder overload instead.

---

## 2. Requirement-by-requirement scorecard

Legend: 🟢 works · 🟡 built but broken/inactive/shallow · 🔴 absent

### #1 Email as sole channel — 🟡 built, broken at edges
- Handler present and correct (`index.ts:13-40`); DO routes `/email` (`kit-agent.ts:168`).
- Breaks on: exact-match sender auth, prod `FAMILY_MEMBERS`, unverified reply destinations
  (see §1.3). All fixable in hours.
- Inbound also logs every message as an event bullet (`process-inbound-message.ts:158-162`).

### #2 Receipt + home printer — 🔴 absent (and architecturally blocked)
- **Zero** printing code anywhere (full grep: only false positives — CSS `label`, README
  "prints a score table").
- **A Cloudflare Worker physically cannot reach a LAN printer.** No `lp`/CUPS, no filesystem,
  no route to a private home IP. A **home bridge daemon is mandatory.**
- The owner already has a working local skill: `~/.claude/skills/print-receipt/print.sh` pipes
  ESC/POS to `lp -d Rongta_RP820 -o raw` (32-col, raw, feed+partial-cut). The same Mac has CUPS
  queues `HP_OfficeJet_8010_series__C669F8_` (home printer, plain `lp`) and
  `HP_Smart_Tank_7300_series__8CDDC0_`.
- Sound path: kit **formats + enqueues** a job (R2 or the DO's SQLite as an outbox); a **home
  daemon polls + prints** via `lp`. Receipt vs. home printer = different `-d` queue / `-o raw`.
  Pull/poll avoids any inbound firewall hole. One daemon serves both printers.

### #3 Independently deployable — 🟡 mostly, with hardcoded blockers
- Bindings (all in `wrangler.jsonc`): `AI`, `KIT_AGENT` (DO), `JOURNAL` (R2 `kit-journal`),
  `SEND_EMAIL`, `assets`.
- Required secrets: `FAMILY_MEMBERS` (**crashes app if missing** — `config.ts:13`), `API_KEY`
  (gates `/journal`,`/agent`,`/admin`; unset → 401 lockout). Optional + graceful: `TWILIO_*`,
  `ICLOUD_APPLE_ID`, `ICLOUD_APP_PASSWORD`.
- Hardcoded blockers for a fresh deploy:
  - `kitkit.dev` custom-domain route (`wrangler.jsonc:48`) — deploy attaches a domain you must
    own; edit or remove.
  - `kit@kitkit.dev` sender (`config.ts:19`; also `email-reply.ts:9`,
    `icloud-calendar-service.ts:167` PRODID).
  - Landing-page URLs (`landing-page.ts:14,15,18,549`), CI smoke `kitkit.dev/health`
    (`ci.yml:46`), cron comment assumes Arizona/MST (`wrangler.jsonc:51`).
  - `.dev.vars` (gitignored, untracked) holds **real PII** (names, personal emails, two phone
    numbers, plaintext `API_KEY`) — scrub/rotate.
- Secret bootstrap is fully manual; CI deploys but never sets secrets.
- Dead weight: the `agents` SDK (`package.json:26`) is **imported nowhere** — `KitAgent extends
  DurableObject` (raw API), not the SDK's `Agent`/`McpAgent`. (Keep it — it's the MCP path; see
  #6.)
- All three entry points present: `fetch` (`index.ts:11`), `email` (`:13`), `scheduled`
  (`:42`, cron `0 14 * * *`).

### #4 Read existing iCloud calendar — 🟡 works, but inactive + single-account
- Read is **implemented, tested, and bundles clean for Workers**
  (`icloud-calendar-service.ts:63-98`, `fetchEvents` + ICS parse w/ recurrence). `tsdav@^2.1.8`;
  `wrangler deploy --dry-run` confirmed the bundler picks cross-fetch's browser ponyfill →
  `globalThis.fetch`, no Node `http`. `nodejs_compat` is set.
- **Inactive:** selected only when both `ICLOUD_APPLE_ID` + `ICLOUD_APP_PASSWORD` set
  (`kit-agent.ts:23-27`); neither is in `.dev.vars` or documented anywhere → NoOp in practice.
  Requires an Apple **app-specific password** (undocumented; real password silently fails auth).
- **Single iCloud account only.** One credential pair → one `ICloudCalendarService`. Owner needs
  **two** accounts (his + wife's) — requires a redesign (list of credential pairs / multiplexing
  service).
- Create event implemented (`:100-133`); update/delete stubbed ("phase 2", `:135-144`).
- **"Holds on BOTH calendars" not supported** — no tentative/hold status, no attendees, no
  multi-account write. `CalendarCreateRequest` has no status/attendees field
  (`calendar-event.ts:21-30`).
- Never validated against the live iCloud server (mock-only tests) — needs one live smoke test.

### #5 Use the bujo memory system — 🟡 embedded, but shallow vs. the vision
- **Kit *is* the bujo code**, backed by R2 (`R2JournalRepository`). Keys under `journal/` as
  `.txt`: `index.txt`, `future-log.txt`, `YYYY/MM/month.txt`, `YYYY/MM/DD/daily.txt`,
  `.../edits.log` (`journal-path.ts:22`, `config.ts:25`). `append` is read-modify-write, no lock
  (fine — the single DO serializes access). `search` is brute-force substring scan.
- **Memory IS populated in practice** (not dead code): every authorized inbound message appends
  an event bullet (`process-inbound-message.ts:158-162`); `remember`/`task`/`list_add` append
  content; the daily cron creates logs, syncs calendar, migrates open tasks, archives >60d.
  → But with calendar off (#4) and inbound failing (#1.3), the only writes that ever happen are
  the empty templates. **That is why the journal — and the email — are empty.**
- **Gap vs. the open-loop tracker** (the core of the vision):

  | Vision need | Kit today |
  |---|---|
  | Loop states: next-action / **waiting-on** / deferred / dropped / done | Only `open/completed/migrated/scheduled/cancelled`. **No "waiting on" / blocked state** — the heart of an open-loop tracker. |
  | Owner/assignee ("who's waiting on whom") | `@person` extracts a **single** person, no owner semantics (`bullet-parser.ts:84`). |
  | Household guide / family brain (pickup owner, meals, vendors) | No structured store. `index.txt` has static empty `## People/## Collections/## Tags` headers, never maintained. |
  | Approval rules | Absent from the domain model. |
  | Threading / stable bullet IDs (`→ ^id` / `← ^id`) | **Not implemented** — Kit bullets have no IDs (IDs only exist in the unbuilt `BUJO_CLI_SPEC.md`). |

- `recall-from-journal` works but is **substring search + LLM synthesis** (Workers AI required),
  not semantic/vector (`recall-from-journal.ts:18,44`).
- **The standalone bujo package does not exist** — only `BUJO_CLI_SPEC.md` +
  `MEMORY_PACKAGE_PLAN.md` (both pre-implementation). The planned `FilesystemJournalRepository`
  uses Node `fs` (won't run on Workers); kit would keep an R2 adapter implementing the package's
  `IJournalRepository` port even after extraction.

### #6 MCP for Claude.ai connectors — 🔴 absent, but closest-to-free
- No MCP code (grep: zero). But the `agents` SDK (already a dependency) ships `McpAgent`
  (`node_modules/agents` exports `./mcp`).
- Claude.ai connectors require a **remote MCP server over HTTPS** (Streamable HTTP/SSE, not
  stdio) with **auth (OAuth 2.0 preferred, or bearer token)**. Cloudflare Workers + the SDK are
  purpose-built for this; kit already has a public domain + a stateful DO.
- Net-new work: a `/mcp` route, tool definitions wrapping existing clean use-cases
  (`processInboundMessage`, `runMorningRoutine`, `build-bullet-digest`, `compile-status`,
  calendar), and an auth layer (token → OAuth). **No LAN problem** — fully cloud-deliverable.
- Bonus synergy: an MCP `print` tool can be the *enqueue* half of the printing bridge (#2).

### Behavior/safety layer vs. the vision (cross-cutting)
- The approval model's defining rule — "**drafts boldly, humans decide**; may not send/buy/book/cancel/
  reschedule/file/submit/contact externally without explicit approval" — is **architecturally
  absent**. Kit has no draft/pending/approved lifecycle.
- Kit's intents (`intent.ts`, 13 types) mostly read or write the journal. The one external write,
  `calendar_add`, calls `calendar.createEvent()` **immediately, ungated**
  (`process-inbound-message.ts:341-348`, `create-calendar-event.ts:25`). Low blast radius today,
  but the pattern is act-first.
- Self-reported `confidence` is **never used to gate** anything (`process-inbound-message.ts:389`)
  — a cheap unused safety lever (route low-confidence to a clarify/confirm path).
- Brief is "summarize the whole journal" (full dump → soft "2-4 sentences" instruction,
  `compile-status.ts:25-99`), **not** the "smallest useful packet" with a single
  decide-this-today item.
- No pattern/recurrence learning despite persona claiming it (`persona.ts:20`).
- `list_view` / `list_clear` are declared intents but **unimplemented no-ops**.

---

## 3. The two things that actually matter

1. **Memory is empty because nothing fills it.** Fix the inflows (email loop + calendar) and seed
   a family brain + open-loop tracker. Without this, every other feature briefs from nothing.
2. **The brain is too weak and on the wrong side of the wall for two goals.** House-manager-grade triage
   needs a frontier model (Claude); free Workers-AI llama is both the digest-failure cause and
   too shallow. Printing needs the home LAN; the richest assistant is Claude itself (the bonus).
   Both pull toward putting Claude in the loop.

---

## 4. Agreed target architecture — hybrid (decisions of record)

**Decision 1 — Topology: Hybrid (cloud spine + home print bridge).**
- The Cloudflare Worker remains the always-on spine: public email endpoint (Email Routing),
  daily cron, R2 memory, and a public MCP endpoint (which a home machine behind NAT can't easily
  provide).
- A small **home daemon** on the Mac (which already has the Rongta + HP CUPS queues and the
  `print-receipt` skill) polls kit for print jobs and runs `lp`. Isolates the only LAN-bound
  concern into ~100 lines.

**Decision 2 — Brain: Dual-model.**
- **Claude (Anthropic API)** for nuance: the daily packet, email replies, triage.
- **Workers AI (llama)** retained for cheap intent classification/routing.
- Rationale: fixes the useless digest (Claude synthesis), keeps per-message classification cheap.

**Decision 3 — Priority: file the diagnosis first (this document). No building yet.**

---

## 5. Recommended phasing (for the eventual build — not started)

Each phase is independently shippable.

1. **Resurrect the loop (hours).** Fix sender auth (normalize + include all of the owner's
   sending addresses, e.g. `danny@tunney.dev`); confirm prod `FAMILY_MEMBERS`; verify reply
   destinations in Email Routing; set `ICLOUD_*` (app-specific password) to turn the calendar on;
   stop the worker from discarding the DO reply status. → daily email becomes real immediately.
2. **Make it smart.** Route digest/replies/triage to Claude; keep llama for classification.
   Redesign the digest as a "smallest useful packet" (a few things that matter, what's drafted,
   one decision, what moved). Fix the structured-object JSON footgun (`workers-ai-service.ts:35`).
3. **Make it useful (the core).** Seed the family brain (who does what, recurring dates,
   meal constraints, vendors, the five open loops). Extend the domain model with a **waiting-on /
   deferred / dropped** open-loop lifecycle + owner field + a maintained household-facts
   collection. Add the **approval boundary** (draft → human approves → act) before adding any
   send/book/buy capability. Two-account iCloud + "holds on both calendars" live here.
4. **Printing.** R2/DO outbox + pull-based home daemon reusing `print-receipt`. Receipt vs. home
   = `-d` queue.
5. **MCP connector (bonus).** Mount `McpAgent` from the already-present `agents` SDK; wrap
   existing use-cases as tools; token auth → OAuth for a polished Claude.ai connector. An MCP
   `print` tool doubles as the enqueue half of #4.

---

## 6. Immediate diagnostics to confirm before any build

Run these read-only checks against the live deployment:
- `wrangler tail` while sending a test email from each of the owner's addresses → distinguishes
  auth-reject vs. DO-500 vs. send-failure (`index.ts`/`kit-agent.ts:173,176`).
- Grep tail logs for `DIGEST_FALLBACK_USED` → confirms the AI digest is failing every morning.
- `wrangler secret list` → confirm `FAMILY_MEMBERS` + `API_KEY` exist in prod; confirm `ICLOUD_*`
  absent.
- Confirm both partners' addresses are verified destinations in Email Routing.

---

## 7. Key file index (entry points for the build)

- Worker entry / handlers: `src/infrastructure/index.ts`
- Composition root (DO): `src/adapters/durable-objects/kit-agent.ts`
- Email: `src/adapters/email/email-message-gateway.ts`, `email-parser.ts`,
  `email-reply.ts` (dead)
- Auth: `src/domain/entities/authorization.ts`, `family-member.ts`; `src/config.ts:12`
- Daily brief: `run-morning-routine.ts`, `send-digest.ts`, `compile-status.ts`,
  `build-bullet-digest.ts`
- AI: `src/adapters/ai/workers-ai-service.ts`, `intent-prompt.ts`; model `config.ts:23`
- Calendar: `src/adapters/calendar/icloud-calendar-service.ts`, `noop-calendar-service.ts`;
  `sync-calendar-to-journal.ts`, `fetch-upcoming-events.ts`, `create-calendar-event.ts`
- Memory: `src/adapters/persistence/r2-journal-repository.ts`; domain `bullet-parser.ts`,
  `signifier.ts`, `journal-path.ts`, `templates.ts`; use-cases `process-inbound-message.ts`,
  `recall-from-journal.ts`
- Deploy: `wrangler.jsonc`, `.github/workflows/ci.yml`, `.dev.vars` (PII — scrub)
- Specs (pre-impl): `BUJO_CLI_SPEC.md`, `MEMORY_PACKAGE_PLAN.md`
- Vision source: the source briefing (a third-party AI house-manager writeup that inspired this —
  we drew ideas from it, we are not rebuilding it)
