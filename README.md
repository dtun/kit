# Kit — Kinetic Intelligence Tool

Family AI assistant running on Cloudflare Workers. Kit manages a household bullet journal, responds to family members via email, and uses AI to help organize daily life.

## Architecture

Kit follows **Clean Architecture** — dependencies point inward, inner layers never import from outer layers.

```
Infrastructure → Adapters → Application → Domain
```

| Layer | Contains | Imports from |
|-------|----------|-------------|
| **Domain** | Entities, value objects, errors | Nothing |
| **Application** | Use cases, port interfaces | Domain |
| **Adapters** | HTTP routes, R2 repos, Durable Objects | Application, Domain |
| **Infrastructure** | Worker entry point, env types | Everything (composition root) |

`src/config.ts` sits outside the hierarchy — importable by any layer.

## Setup

```bash
nvm use
npm install
```

### Prerequisites

- Node.js 22+
- Cloudflare account with Workers, R2, and AI enabled
- R2 bucket: `wrangler r2 bucket create kit-journal`
- GitHub secret: `CLOUDFLARE_API_TOKEN`

### Calendar (iCloud)

Kit reads household events from an iCloud calendar over CalDAV. Two secrets enable it:

| Secret | Notes |
|--------|-------|
| `ICLOUD_APPLE_ID` | The Apple ID email for the account whose calendars Kit reads |
| `ICLOUD_APP_PASSWORD` | An **app-specific password**, not the account password |

Generate the app-specific password at [appleid.apple.com](https://appleid.apple.com) under **Sign-In and Security → App-Specific Passwords**. Apple CalDAV rejects the normal account password, so this step is required.

Set them for production with `wrangler secret put ICLOUD_APPLE_ID` and `wrangler secret put ICLOUD_APP_PASSWORD`; for local dev add them to `.dev.vars` (see `.dev.vars.example`).

**If either secret is unset, Kit silently falls back to a no-op calendar** — it syncs zero events and daily digests will be empty. The `/health` endpoint reports a `calendarConfigured` flag so you can confirm the secrets are wired (see [#2](https://github.com/dtun/kit/issues/2)).

Only a single iCloud account is supported today; multi-account support is tracked separately.

## Deploy from zero

Kit is built to be forked and self-hosted. To stand up your own instance:

1. **Pick your domain.** Set `KIT_DOMAIN` in [`src/config.ts`](src/config.ts) to a domain you own (it defaults to `kitkit.dev`). Everything — sender address, landing-page OG tags, links — derives from this one constant.
2. **Wire the custom domain (or skip it).** In [`wrangler.jsonc`](wrangler.jsonc), change the `routes` pattern to your domain (which must be onboarded to Cloudflare), or delete the `routes` block to serve from the default `*.workers.dev` URL. Keep it in sync with `KIT_DOMAIN`.
3. **Create the R2 bucket:** `wrangler r2 bucket create kit-journal`.
4. **Enable Email Routing** for your domain in the Cloudflare dashboard, add the destination address(es) you want replies to come from / go to, and verify them. Kit sends via Cloudflare Email Routing (the `SEND_EMAIL` binding).
5. **Set production secrets** with `wrangler secret put` (see below). CI deploys but never sets secrets.
6. **Adjust the cron** in `wrangler.jsonc` if you want the morning digest at local 7 AM — the default `0 14 * * *` is 7 AM Arizona/MST (no DST).
7. **Deploy:** `npm run deploy` (or push to `main` to let CI deploy).
8. **Verify:** `npm run doctor` — confirms the bindings, secrets, readiness flags, and reply destinations are actually wired up (see [Verifying a deployment](#verifying-a-deployment)).

### Production secrets

CI runs `wrangler deploy` but **never sets secrets** — you bootstrap these once per environment with `wrangler secret put <NAME>`:

| Secret | Required | Purpose |
|--------|----------|---------|
| `FAMILY_MEMBERS` | yes | JSON roster of family members (see `.dev.vars.example`) |
| `API_KEY` | yes | Guards authenticated routes (e.g. `/agent/status`) |
| `ICLOUD_APPLE_ID` | optional | Apple ID for the iCloud calendar account |
| `ICLOUD_APP_PASSWORD` | optional | App-specific password (not the account password) |
| `ANTHROPIC_API_KEY` | optional | Enables Claude-backed AI features (falls back to Workers AI if unset) |
| `TWILIO_ACCOUNT_SID` | optional | Twilio SMS account SID |
| `TWILIO_AUTH_TOKEN` | optional | Twilio auth token |
| `TWILIO_PHONE_NUMBER` | optional | Twilio sending number |

For local dev, copy `.dev.vars.example` to `.dev.vars` and fill in placeholders — `wrangler dev` reads them automatically.

## Verifying a deployment

A green deploy proves the code shipped, not that the deployment is *wired up* — CI never sets secrets, and Kit degrades silently when they are missing (no calendar, no Claude, no digest data). Two things make that visible.

### `GET /health`

Unauthenticated readiness report:

```json
{
  "status": "ok",
  "name": "Kit",
  "version": "0.1.0",
  "timestamp": "2026-08-01T14:00:03.114Z",
  "familyMembersValid": true,
  "calendarConfigured": true,
  "aiBrainConfigured": true,
  "aiBrainModel": "claude-opus-4-8",
  "lastCron": { "at": "2026-08-01T14:00:12.882Z", "ok": true }
}
```

| Field | Means | Fix when false |
|-------|-------|----------------|
| `familyMembersValid` | `FAMILY_MEMBERS` is set and parses | `wrangler secret put FAMILY_MEMBERS` |
| `calendarConfigured` | both iCloud secrets are present | `wrangler secret put ICLOUD_APPLE_ID` / `ICLOUD_APP_PASSWORD` |
| `aiBrainConfigured` | `ANTHROPIC_API_KEY` is present — Claude is the reasoning brain | `wrangler secret put ANTHROPIC_API_KEY` |
| `aiBrainModel` | the model digests and replies actually use (the Workers AI fallback when Claude is unconfigured) | — |
| `lastCron` | outcome of the most recent scheduled run, or `null` if it has never run | check `wrangler tail` and the cron trigger |

Secrets are reported as **presence only** — no value or prefix is ever serialized. `lastCron` is a single record persisted to the `KitAgent` Durable Object's SQLite at the end of every scheduled run (both the success and failure paths); each run overwrites the previous one, and a failure carries a short truncated `reason`.

### `npm run doctor`

Checks a whole deployment and exits non-zero on any failure, so it can gate CI:

```bash
npm run doctor                                  # checks https://kitkit.dev
npm run doctor -- --url https://staging.example.com
npm run doctor -- --skip-remote                 # config + roster only, no network
```

It verifies the `wrangler.jsonc` bindings (R2, Durable Object + migration, Workers AI, `SEND_EMAIL`, cron trigger), which secrets are set on the deployed worker (`wrangler secret list` — names only), every readiness flag on the live `/health`, and that each entry in `FAMILY_MEMBERS` has a usable reply address for its channel. The roster check reads `FAMILY_MEMBERS` from the environment or `.dev.vars`, since production secret values cannot be read back.

```
Deployed health (https://kitkit.dev)
  ✔ status — ok (Kit 0.1.0)
  ✔ familyMembersValid
  ✖ calendarConfigured — false — set ICLOUD_APPLE_ID + ICLOUD_APP_PASSWORD
  ✔ aiBrainConfigured
  ✖ lastCron — the scheduled routine has never completed on this deployment
```

Set `CLOUDFLARE_API_TOKEN` (or run `wrangler login`) for the secret check; without it that section warns and is skipped rather than failing.

## Security

- **`.dev.vars` is gitignored and must never be committed.** It holds local copies of every production secret. Only `.dev.vars.example` (placeholders only) is tracked.
- **Rotate `API_KEY`.** Any `API_KEY` value that has lived in a local `.dev.vars` should be rotated before relying on it in production — generate a fresh long random string and `wrangler secret put API_KEY`.
- **Pointers, not secrets.** Future integrations (e.g. a home daemon) should store *references* to credentials (paths, IDs) in config and keep the credentials themselves in Cloudflare secrets — never inline real secrets in tracked files.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start local dev server |
| `npm test` | Run unit tests |
| `npm run test:integration` | Run integration tests (Workers runtime) |
| `npm run test:all` | Run all tests |
| `npm run test:domain` | Run domain tests only |
| `npm run test:app` | Run application tests only |
| `npm run test:adapters` | Run adapter tests only |
| `npm run doctor` | Verify a deployment is wired up (see [Verifying a deployment](#verifying-a-deployment)) |
| `npm run check` | Lint and format check |
| `npm run check:fix` | Auto-fix lint and format issues |
| `npm run typecheck` | TypeScript type check |
| `npm run eval:dev` | Watch-mode LLM evals with Evalite UI |
| `npm run eval:run` | Run LLM evals once |
| `npm run eval:ci` | Run LLM evals with a 0.8 score threshold |
| `npm run deploy` | Deploy to Cloudflare |

## Evals

Kit uses [Evalite](https://evalite.dev) for LLM-output-quality evaluations — separate from the 200+ unit tests under `test/`. Evals exercise Kit's real classifier against a golden dataset of family interactions, scoring each case with deterministic and heuristic scorers. See `eval/` for datasets, scorers, and suites.

### Required environment

Evals call the Cloudflare Workers AI REST API from Node, so you need:

```bash
export CLOUDFLARE_API_TOKEN=...      # scoped to Workers AI
export CLOUDFLARE_ACCOUNT_ID=...
export CLOUDFLARE_AI_MODEL=@cf/meta/llama-3.1-8b-instruct   # optional override
```

### Running

| Command | Use case |
|---------|----------|
| `npm run eval:dev` | Local iteration — watches files and serves the Evalite UI at http://localhost:3006 |
| `npm run eval:run` | One-shot run, prints a score table |
| `npm run eval:ci` | CI mode — exits non-zero if any eval drops below 0.8 |

### Tier 1 suites (current)

- `intent-classification.eval.ts` — 25+ cases covering every intent type
- `forwarded-emails.eval.ts` — Apple Mail / Gmail / Outlook parsing + extraction
- `cold-start.eval.ts` — empty-journal behavior, no-confusion language, signoff

### Adding a golden case

Every confusing real-world interaction should become a test case. Add it to the appropriate file under `eval/datasets/` and push — the next `eval:run` will pick it up. Keep datasets honest with shape assertions in `test/eval/datasets.test.ts`.

## CI/CD

Push to `main` triggers: **Lint & Test → Deploy → Smoke Test** (`https://$SMOKE_HOST/health`, defaulting to `kitkit.dev`). A fork can override the smoke host by setting a `SMOKE_HOST` repository variable. CI never sets app secrets — see [Production secrets](#production-secrets).

## Layer Boundary Rules

- `domain/` must have zero imports from other layers or external packages
- `application/` imports from `domain/` only (and `@config`)
- `adapters/` imports from `application/` and `domain/`
- `infrastructure/` is the composition root — wires everything together

Path aliases (`@domain/*`, `@application/*`, `@adapters/*`, `@infrastructure/*`, `@config`) enforce readable imports.
