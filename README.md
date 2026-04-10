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

Push to `main` triggers: **Lint & Test → Deploy → Smoke Test** (`https://kitkit.dev/health`).

## Layer Boundary Rules

- `domain/` must have zero imports from other layers or external packages
- `application/` imports from `domain/` only (and `@config`)
- `adapters/` imports from `application/` and `domain/`
- `infrastructure/` is the composition root — wires everything together

Path aliases (`@domain/*`, `@application/*`, `@adapters/*`, `@infrastructure/*`, `@config`) enforce readable imports.
