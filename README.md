# ResQ-Go

Ambulance booking, dispatch and live tracking — a modular monolith with a **Next.js** web app, a
**NestJS** API, and a shared contracts package.

ResQ-Go is **not** a replacement for emergency medical services. In a life-threatening emergency,
call your local emergency number (911 / 112) first.

---

## What it does

A patient requests ambulance transport; dispatch finds the nearest suitable, available vehicle; the
crew accepts, runs the trip step by step, and shares position; the patient watches the status change
live. Patients, drivers, and dispatchers all read the same enforced state machine.

| Role | What they do |
|---|---|
| **Patient** | One-tap emergency request, planned bookings, live status and ETA, crew contact, cancellation |
| **Driver** | Accept or decline assignments, advance trip status, share position, set availability |
| **Dispatcher** | Urgency-ranked queue, eligible vehicles ranked by distance, atomic assignment, live trip map |

## Stack

- **`apps/web`** — Next.js 14 (App Router, React 18), TypeScript strict, plain CSS design system,
  Leaflet for live maps, server-sent events for live updates.
- **`apps/api`** — NestJS 10, Prisma + PostgreSQL, Zod validation, JWT auth, SSE.
- **`packages/contracts`** — Shared enums, Zod schemas, views, and the booking state machine used by
  both sides. The UI cannot invent a status the API has not allowed.
- **`packages/config`**, **`packages/eslint-config`** — shared configuration.

---

## Quick start (Docker — recommended)

Prerequisites: Docker with Compose v2.

```bash
git clone <repository-url>
cd ResQ-Go
cp .env.example .env          # Windows: copy .env.example .env

# Generate a real signing secret and paste it into .env as JWT_SECRET
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

docker compose up --build
```

- Web — <http://localhost:3000>
- API — <http://localhost:3001/api/v1> · health: <http://localhost:3001/api/v1/health>

Compose builds the **same Dockerfiles used in production**, so a successful `up` also verifies the
images build and start. Schema changes are applied automatically on boot.

### Seeded demo accounts (synthetic data, local only)

| Role | Email | Password |
|---|---|---|
| Patient | `patient@example.com` | `Patient#2024` |
| Driver | `driver@example.com` | `Driver#2024` |
| Dispatcher | `dispatcher@example.com` | `Dispatch#2024` |
| Admin | `admin@example.com` | `Admin#2024` |

These accounts are **not** created by the production image. Loading them locally:

```bash
docker compose run --rm migrate   # db push + seed
```

## Quick start (running the apps on your machine)

Prerequisites: **Node.js >= 20**, npm >= 10, and either Docker (for the database) or your own
PostgreSQL instance.

```bash
npm install
cp .env.example .env

# Database only, in Docker
docker compose -f infra/docker-compose.yml up -d postgres

npm run db:push      # create the schema
npm run db:seed      # load synthetic demo data

npm run dev:api      # http://localhost:3001
npm run dev:web      # http://localhost:3000
```

---

## Commands

| Command | Purpose |
|---|---|
| `npm run dev:api` / `npm run dev:web` | Run one workspace in watch mode |
| `npm run build` | Build every workspace |
| `npm run test` | Run all test suites |
| `npm run lint` | Lint the web workspace |
| `npm run db:push` | Sync the Prisma schema to the configured database |
| `npm run db:seed` | Load synthetic demo data (idempotent) |
| `npm run db:migrate` | Create and apply a Prisma migration |

---

## Tests

```bash
npm test
```

The suite has two halves:

- **Unit tests** (`auth`, `bookings`, `dispatch`, `booking-state-machine`, `runtime-config`) run with
  no external services and need no database.
- **The end-to-end suite** (`request-to-completion.spec.ts`) boots the real Nest module graph against
  a real PostgreSQL database and walks the full lifecycle: one-tap emergency request → dispatch
  assignment → crew accept → en route → arrived → on board → in transit → completed. It also asserts
  the guard rails (a vehicle without crew can never be dispatched, a booking can only be dispatched
  once, a booking stays private to the people involved).

  It needs a database:

  ```bash
  docker compose -f infra/docker-compose.yml up -d postgres
  npm run db:push
  npm test
  ```

  Without one it **fails loudly** with the connection details it tried, rather than skipping — a
  silent skip would report success for a suite that never ran. Point `TEST_DATABASE_URL` at another
  instance if you prefer.

---

## Health checks

| Endpoint | Meaning | On failure |
|---|---|---|
| `GET /api/v1/health` | Liveness — the process is up | Orchestrator may restart |
| `GET /api/v1/health/ready` | Readiness — the database answers | Answers `503`, traffic is withheld |

Liveness deliberately does not touch the database, so a database blip never triggers a restart loop.

---

## Environment configuration

Every variable is documented in [`.env.example`](.env.example), including which app reads it.
`JWT_SECRET` is mandatory; the API refuses to boot with a missing, placeholder, or under-length
secret in production, and rejects a wildcard `CORS_ORIGIN`.

---

## Deployment

### Render (Blueprint)

[`render.yaml`](render.yaml) provisions PostgreSQL, the API, and the web app — both built from the
Dockerfiles in this repository, so Render runs the same artefacts as local Compose.

Render prompts for `JWT_SECRET`, `CORS_ORIGIN`, and `NEXT_PUBLIC_API_URL` on first run. Set
`NEXT_PUBLIC_API_URL` to the API's public URL once Render has assigned it; it is read at build time.

### Vercel (web only) + Render (API)

The web app deploys to Vercel with [`vercel.json`](vercel.json). Set `NEXT_PUBLIC_API_URL` in the
Vercel environment and point `CORS_ORIGIN` at the Vercel domain on the API service.

---

## Repository layout

```text
.
├── apps/
│   ├── api/            NestJS API, Prisma schema, seed, Dockerfile
│   │   └── src/        auth, bookings, dispatch, trips, notifications, audit, health, realtime
│   └── web/            Next.js app, design system, Dockerfile
├── packages/
│   ├── contracts/      Shared enums, Zod schemas, views, booking state machine
│   ├── config/         Shared env helpers and constants
│   └── eslint-config/
├── docs/               Product, design, rules, data model, security, roadmap
├── infra/              Database-only Compose file
├── docker-compose.yml  Full local stack
└── render.yaml         Render Blueprint
```

## Documentation

- [PRODUCT.md](docs/PRODUCT.md) — product requirements and user journeys
- [DESIGN.md](docs/DESIGN.md) — architecture and technical boundaries
- [RULES.md](docs/RULES.md) — non-negotiable business and engineering rules
- [DATA_MODEL.md](docs/DATA_MODEL.md) — data model and persistence strategy
- [Security_Vulneravility.md](docs/Security_Vulneravility.md) — security checklist and register
- [AGENTS.md](AGENTS.md) — how humans and agents work on this repository