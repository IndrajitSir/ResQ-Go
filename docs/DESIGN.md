# DESIGN.md — System Architecture and Technical Design

## Purpose

This document describes the technical architecture of the Ambulance Booking System.

> **Maintenance rule:** Update this document whenever a module, integration, database, deployment topology, communication protocol, or major technical decision changes.

## Architectural Direction

The initial implementation should be a **modular monolith**:

- Next.js application for the user-facing web experience and administrative interfaces.
- NestJS application for domain logic, authentication, dispatch, booking, notifications, and integrations.
- Separate databases or storage systems may be used for different workloads.
- Background workers may be introduced for notifications, expiry jobs, analytics, and other asynchronous tasks.

The system should be designed so that high-load modules can later be extracted into services without rewriting the domain model.

## High-Level Components

```text
Users
 ├── Patient / Customer
 ├── Ambulance Driver / Crew
 ├── Hospital / Receiving Facility
 ├── Dispatcher / Operator
 └── System Administrator

        │
        ▼
Next.js Web Application
        │
        ▼
NestJS API
 ├── Auth and Identity
 ├── Users and Profiles
 ├── Ambulance Fleet
 ├── Booking and Trip
 ├── Dispatch
 ├── Driver Availability
 ├── Hospital and Destination
 ├── Pricing / Billing
 ├── Notifications
 ├── Reviews / Support
 ├── Audit and Compliance
 └── Reporting

        │
        ├── Relational Database
        ├── Redis / Cache / Queue
        ├── Object Storage
        ├── Search or Analytics Store
        ├── Notification Providers
        └── Maps / Routing Provider
```

## Frontend Design

### Next.js Responsibilities

- Route rendering and navigation.
- Authentication-aware layouts.
- Booking forms and status displays.
- Driver and dispatcher dashboards.
- Accessible error, loading, and empty states.
- Optimistic UI only where rollback is safe.
- Presentation-level validation and user feedback.

### Suggested Route Groups

```text
app/
├── (public)/
│   ├── page.tsx
│   ├── book/
│   └── hospitals/
├── (auth)/
│   ├── login/
│   ├── register/
│   └── verify/
├── (patient)/
│   ├── bookings/
│   ├── bookings/[id]/
│   └── profile/
├── (driver)/
│   ├── dashboard/
│   ├── trips/
│   └── availability/
├── (dispatcher)/
│   ├── dispatch/
│   ├── bookings/
│   └── fleet/
└── (admin)/
    ├── users/
    ├── reports/
    └── settings/
```

Use route groups and layouts to isolate role-specific navigation and permissions.

## Backend Module Boundaries

Suggested NestJS modules:

- `AuthModule`
- `UsersModule`
- `RolesModule`
- `AmbulancesModule`
- `DriversModule`
- `HospitalsModule`
- `BookingsModule`
- `TripsModule`
- `DispatchModule`
- `LocationsModule`
- `PricingModule`
- `PaymentsModule`
- `NotificationsModule`
- `FilesModule`
- `ReviewsModule`
- `AuditModule`
- `HealthModule`
- `ReportsModule`

Each module should have:

```text
module/
├── controller/
├── application/
├── domain/
├── infrastructure/
├── dto/
├── entities-or-models/
└── tests/
```

Do not force every module into this exact layout if it makes a small module unnecessarily complex.

## Booking Lifecycle

A booking should use explicit states:

```text
DRAFT
  → REQUESTED
  → SEARCHING
  → ASSIGNED
  → DRIVER_EN_ROUTE
  → ARRIVED
  → PATIENT_ONBOARD
  → IN_TRANSIT
  → COMPLETED
```

Alternative terminal states:

```text
CANCELLED_BY_PATIENT
CANCELLED_BY_OPERATOR
EXPIRED
REJECTED
FAILED
```

Every transition must be validated by the backend. A client must not be able to directly set `COMPLETED` or `ARRIVED`.

## Dispatch Design

Dispatch may initially be manual-assisted:

1. Booking is created.
2. System validates pickup and destination.
3. Dispatcher sees eligible ambulances.
4. System filters by availability, capability, service area, and crew status.
5. Dispatcher assigns an ambulance.
6. Driver or crew confirms acceptance.
7. Trip status updates are recorded.
8. Patient receives notifications.

Later, an automated dispatch engine may rank candidates using documented rules. The ranking logic must remain explainable and auditable.

## Real-Time Updates

Use WebSockets or Server-Sent Events for:

- Booking status.
- Driver location, subject to privacy and consent rules.
- Dispatcher updates.
- Driver assignment.
- Emergency notifications.

REST remains the source of truth for commands. Real-time messages are notifications of state changes, not authoritative state themselves.

## Data Storage Strategy

The system may use multiple stores:

| Store | Purpose |
|---|---|
| PostgreSQL | Users, bookings, trips, ambulances, payments, audit records |
| Redis | Short-lived cache, rate limiting, distributed locks, queues |
| Object storage | Documents, invoices, vehicle papers, profile images |
| Search engine | Optional search across hospitals, locations, and operational records |
| Analytics warehouse | Optional reporting and historical analysis |
| Geospatial extension | Location queries and proximity matching |

The initial database should be selected based on the strongest consistency requirements, not convenience alone.

## API Design

- Use versioned APIs, such as `/api/v1`.
- Use consistent response envelopes.
- Return stable error codes.
- Use idempotency keys for booking creation, payment initiation, and other retryable commands.
- Use pagination for list endpoints.
- Avoid exposing internal database IDs when a public identifier is more appropriate.
- Document APIs using OpenAPI.

## Reliability

Important workflows must support:

- Idempotent retries.
- Transaction boundaries.
- Outbox events for reliable notifications.
- Timeouts for external providers.
- Circuit breakers or bounded retries where appropriate.
- Dead-letter queues for failed asynchronous jobs.
- Health and readiness endpoints.

## Observability

Collect:

- Structured logs.
- Request IDs and correlation IDs.
- Booking/trip identifiers without exposing sensitive data.
- Metrics for booking success, assignment latency, cancellation, notification failure, and API errors.
- Distributed traces when the system becomes distributed.

## Deployment

Recommended initial environments:

- Local development using Docker Compose.
- Staging environment with isolated credentials and databases.
- Production environment with backups, monitoring, TLS, secret management, and controlled migrations.

### Implemented as of this revision

- `docker-compose.yml` at the repository root builds the **production** Dockerfiles and runs the full
  stack (postgres -> migrate -> api -> web), so local `up` also validates the images. A one-shot
  `migrate` service applies the schema and seeds; `api` waits for it to finish.
- `infra/docker-compose.yml` is the lighter alternative: database only, for running the apps on the
  host with `npm run dev:*`.
- `apps/api/Dockerfile` and `apps/web/Dockerfile` are multi-stage, run as the unprivileged `node`
  user, declare health checks, and never bake in secrets. The web image uses Next `output:
  'standalone'`, so it ships only the modules it actually imports.
- `render.yaml` deploys **those same Dockerfiles**, so Render runs the artefact that was verified
  locally rather than a second, divergent build path.
- The API container synchronises the Prisma schema at boot and deliberately does **not** seed demo
  accounts: seeded users ship with published passwords and have no place in a deployed environment.

### Health endpoints

| Endpoint | Depends on | Failure behaviour |
|---|---|---|
| `GET /api/v1/health` | nothing | Orchestrator may restart the container |
| `GET /api/v1/health/ready` | database (`SELECT 1`) | Answers `503`, traffic is withheld |

Liveness deliberately does not touch the database so a database blip cannot trigger a restart loop.
Readiness reports only the failure *category*, never the underlying message, which can contain
connection details.

## Cross-Cutting Concerns (implemented)

### Request pipeline

Middleware order is deliberate: correlation id first, so every later log line including errors can
reference it, then security headers, then the access log.

- `RequestIdMiddleware` assigns a UUID and echoes it as `x-request-id`.
- `SecurityHeadersMiddleware` sets clickjacking, sniffing, CSP, caching, referrer and permissions
  policies. HSTS is only sent when `NODE_ENV=production`.
- `RequestLoggerMiddleware` emits one JSON line per completed request with the method, **scrubbed**
  path, status, and duration. Resource identifiers are replaced with `:id` and query strings are
  dropped, so an access log never becomes a record of who requested which booking, and never captures
  a bearer token from an SSE URL.

### Configuration

`common/config/env.ts` parses and validates the environment once, at bootstrap, before the port is
bound. A misconfigured deployment fails immediately with one actionable message. It rejects a
missing, placeholder, or under-length `JWT_SECRET` in production, a wildcard or non-absolute
`CORS_ORIGIN`, and an out-of-range `BCRYPT_ROUNDS`. `CORS_ORIGIN` is an explicit comma-separated
allowlist — the request origin is never reflected back.

### Frontend design system

`apps/web/src/app/globals.css` is a token-driven system (colour, type scale, spacing, radii, motion)
with a semantic layer consumed by components, and a light and dark theme. `landing.css` holds the
narrative page styles. Components are built on shared primitives in `components/ui.tsx`.

Motion is CSS- and `IntersectionObserver`-driven rather than a third-party animation library: it adds
no bundle weight, degrades gracefully, and `prefers-reduced-motion` is honoured by skipping animation
rather than merely shortening it. The landing "journey" demo validates every transition it shows
against the shared state machine at import time, so the storytelling cannot drift into showing an
impossible workflow, and is explicitly labelled a simulation.

### Browser security headers

The API sets its own headers, but the browser loads the HTML app directly, so `apps/web/next.config.js`
sets a matching set there: CSP, `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy:
no-referrer`, `X-DNS-Prefetch-Control`, and a `Permissions-Policy` that allows geolocation and denies
camera and microphone. HSTS is added only under `NODE_ENV=production`. `poweredByHeader` is already
false, so no framework banner is emitted.

The CSP is built from the origins this app actually uses rather than a template:

- `img-src` allows OpenStreetMap raster tiles for the Leaflet map.
- `connect-src` allows the API origin, derived from `NEXT_PUBLIC_API_URL` at build time.
- `script-src` and `style-src` need `'unsafe-inline'`, because Next.js 14 inlines the RSC flight
  payload and Leaflet positions panes with inline style attributes. A per-request nonce would remove
  this, but only by forcing every route out of static prerendering, which is the worse trade here.
  `'unsafe-eval'` is added outside production only, for React Fast Refresh.
- `frame-ancestors 'none'` and `object-src 'none'` match the API's no-framing policy.

Verified in a browser against the standalone production artefact: zero console messages and zero CSP
violations, with the theme toggle, role tabs and journey demo all still interactive.

## Architecture Decision Record

For significant decisions, record:

- Decision date.
- Context.
- Options considered.
- Decision.
- Consequences.
- Revisit conditions.

## Changelog

- Initial version: project recreation from scratch.
- 2026-10-03: Added health/readiness split, security-header and structured request-logging
  middleware, validated runtime configuration, token-driven frontend design system with light/dark
  themes, Docker images for both services, and a Render blueprint that deploys those images.
- 2026-10-03: Added browser security headers (CSP, framing, referrer, permissions policy) to the
  Next.js app, which previously emitted none. The API was already hardened; the HTML tier was not.
