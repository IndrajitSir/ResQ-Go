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
