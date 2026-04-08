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
| `npm run deploy` | Deploy to Cloudflare |

## CI/CD

Push to `main` triggers: **Lint & Test → Deploy → Smoke Test** (`https://kitkit.dev/health`).

## Layer Boundary Rules

- `domain/` must have zero imports from other layers or external packages
- `application/` imports from `domain/` only (and `@config`)
- `adapters/` imports from `application/` and `domain/`
- `infrastructure/` is the composition root — wires everything together

Path aliases (`@domain/*`, `@application/*`, `@adapters/*`, `@infrastructure/*`, `@config`) enforce readable imports.
