# Ambulance Booking System

A booking and coordination platform for ambulance services. It is **not** a replacement for emergency medical services or local emergency hotlines — in a life-threatening emergency, always call your local emergency number.

## Stack

- **`apps/web`** — Next.js (App Router) web application for patients, drivers, and dispatchers.
- **`apps/api`** — NestJS API with the domain logic, authentication, booking, dispatch, and audit modules.
- **`packages/contracts`** — Shared DTOs, enums, booking state machine, and Zod validation schemas.
- **`packages/config`**, **`packages/eslint-config`** — Shared configuration.

## Quick start (local development)

Prerequisites: Node.js >= 20 and npm >= 10. Docker is **optional** (the API defaults to SQLite locally).

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
copy .env.example .env

# 3. Create the local database schema and seed demo data
npm run db:push
npm run db:seed

# 4. Run the API (http://localhost:3001) and the web app (http://localhost:3000)
npm run dev:api
npm run dev:web
```

### Seeded demo accounts (synthetic data only)

| Role | Email | Password |
|---|---|---|
| Patient | `patient@example.com` | `Patient#2024` |
| Driver | `driver@example.com` | `Driver#2024` |
| Dispatcher | `dispatcher@example.com` | `Dispatch#2024` |
| Admin | `admin@example.com` | `Admin#2024` |

## Useful commands

| Command | Purpose |
|---|---|
| `npm run build` | Build all workspaces |
| `npm run test` | Run all tests |
| `npm run db:push` | Sync Prisma schema to the local database |
| `npm run db:seed` | Seed demo users/ambulances |
| `npm run db:migrate` | Apply Prisma migrations (used with PostgreSQL) |

## Documentation

All project documentation lives in [`docs/`](docs/):

- [PRODUCT.md](docs/PRODUCT.md) — product requirements and user journeys.
- [DESIGN.md](docs/DESIGN.md) — architecture and technical boundaries.
- [RULES.md](docs/RULES.md) — non-negotiable business and engineering rules.
- [DATA_MODEL.md](docs/DATA_MODEL.md) — data model and persistence strategy.
- [Security_Vulneravility.md](docs/Security_Vulneravility.md) — security checklist and register.
- [TODO.md](docs/TODO.md) — current work queue.
- [ROADMAP.md](docs/ROADMAP.md) — phased roadmap.
- [KNOWLEDGE_BASE.md](docs/KNOWLEDGE_BASE.md) — durable project knowledge and local setup notes.
- [AGENTS.md](AGENTS.md) — how humans and AI agents work on this repository.
