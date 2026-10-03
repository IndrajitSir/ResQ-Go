# TODO.md — Current Work Queue

## Purpose

This is the actionable backlog for the current development cycle.

> **Maintenance rule:** Update this file whenever work is started, completed, blocked, reprioritized, or discovered. Move larger initiatives to `ROADMAP.md`.

## Status Legend

- `[ ]` Not started
- `[-]` In progress
- `[x]` Completed
- `[!]` Blocked
- `[?]` Needs a decision

## Foundation

- [x] Create monorepo structure.
- [x] Initialize Next.js application.
- [x] Initialize NestJS application.
- [x] Configure TypeScript strict mode.
- [x] Configure linting and formatting.
- [ ] Add commit hooks and CI.
- [x] Add `.env.example`.
- [x] Add Docker Compose for local dependencies.
- [x] Define development, staging, and production environments.

## Product Decisions

- [ ] Confirm initial operating geography.
- [ ] Confirm whether the product serves one fleet or multiple operators.
- [ ] Define ambulance categories.
- [ ] Define cancellation policy.
- [ ] Decide whether payments are included in version one.
- [ ] Define emergency escalation messaging.
- [ ] Confirm hospital integration requirements.

## Authentication and Authorization

- [x] Implement registration and login.
- [ ] Implement verification flow.
- [ ] Implement session refresh and revocation.
- [x] Implement role-based authorization.
- [x] Implement resource ownership checks.
- [ ] Add privileged-role MFA.
- [x] Add authentication rate limiting.
- [x] Add authorization tests.

## Booking

- [x] Create booking domain model.
- [x] Implement booking creation.
- [x] Add idempotency support.
- [x] Implement booking state machine.
- [x] Implement cancellation.
- [x] Implement booking event history.
- [x] Add patient booking history.
- [x] Add booking detail page.
- [ ] Add failure and retry handling. *(assignment conflicts surface a clean 409; no automatic retry yet)*

## Fleet and Dispatch

- [x] Implement ambulance CRUD.
- [x] Implement driver profile and verification.
- [x] Implement driver availability.
- [x] Implement eligible ambulance search.
- [x] Implement dispatcher dashboard.
- [x] Implement assignment locking.
- [x] Implement driver acceptance/rejection.
- [x] Implement reassignment workflow.
- [x] Add maintenance and suspension states.

## Notifications and Real-Time

- [ ] Select notification providers.
- [x] Implement notification templates.
- [ ] Implement outbox pattern.
- [ ] Add retry and dead-letter handling.
- [x] Add WebSocket or SSE status updates.
- [ ] Add notification delivery metrics.

## Security

- [x] Add validation to every endpoint.
- [ ] Add rate limiting. *(login only; booking creation and public endpoints remain unbounded)*
- [x] Add secure headers.
- [x] Add CSRF protection where applicable. *(bearer-token API with no cookie auth to forge)*
- [ ] Add object-level authorization tests. *(e2e covers cross-patient read and non-crew location ping; broaden)*
- [ ] Add dependency scanning.
- [ ] Add secret scanning.
- [ ] Add upload restrictions. *(no upload feature exists; N/A until one does)*
- [x] Add audit logging.
- [x] Review `Security_Vulneravility.md`.

## Quality

- [x] Unit tests for booking transitions.
- [x] Integration tests for assignment concurrency.
- [x] End-to-end test for request-to-completion flow.
- [x] Accessibility review.
- [x] Mobile responsiveness review.
- [ ] Load test critical endpoints.
- [ ] Backup and restore test.
- [ ] Incident response checklist.

## Documentation

- [x] Keep all project Markdown files synchronized with implementation.
- [ ] Add architecture decision records.
- [x] Document local setup.
- [x] Document deployment.
- [ ] Document operational runbooks.
- [ ] Record unresolved product questions.

## Product UI/UX

- [x] Design system: tokens, type scale, spacing, primitives, light and dark themes.
- [x] Redesign landing page with interactive, state-machine-backed storytelling.
- [x] Apply the design system to every application screen.
- [x] Accessible mobile navigation, empty states, loading skeletons, inline validation.
- [x] Fix booking form destination coordinates (previously sent as pickup coordinates).
- [ ] Date and time formatting in the viewer's own timezone (all timestamps currently render in UTC).

## Blocked — could not be verified in this environment

These are **not** implemented-but-untested by choice. The development machine used for this
revision had no Docker daemon and no usable local PostgreSQL, so neither could be executed. They are
recorded here so the next engineer runs them first rather than assuming they were covered.

- [!] **Build and run the Docker images.** No Docker daemon was available, so
  [apps/api/Dockerfile](apps/api/Dockerfile), [apps/web/Dockerfile](apps/web/Dockerfile),
  [docker-compose.yml](docker-compose.yml) and [render.yaml](render.yaml) were validated statically
  only — YAML parses, the compose dependency graph resolves, every `COPY` source exists, and the
  entrypoint is LF-clean — but never built or run. **First action on a Docker-capable machine:**
  `docker compose up --build`, then confirm `/api/v1/health` answers 200 and `/` loads.
- [!] **Run the 7 end-to-end tests in `apps/api/src/__tests__/request-to-completion.spec.ts`.**
  They need a reachable PostgreSQL instance. The bundled `embedded-postgres` binary fails to start
  on this machine (Windows exit `3221225781`, missing `msvcp140.dll`/`vcruntime140*.dll`), and
  installing the Visual C++ runtime is a system-wide change that was out of scope. The suite now
  fails loudly with the connection target and remediation instead of skipping. It is the only
  coverage of the booking lifecycle across patient, dispatcher and driver.
- [!] **Verify the SSE live-tracking stream end to end.** It depends on the same missing database.
  The token-in-query-string gap below can only be confirmed fixed once this runs.

## Changelog

- Initial backlog.
- 2026-10-03: Reconciled the backlog with the implementation after the UI/UX, backend hardening,
  and DevOps revision. Items marked `[x]` are implemented *and* verified; partial work is called out
  inline rather than left ambiguous.
- 2026-10-03: Added the "Blocked" section above, recording the three checks that could not be
  executed in this environment so they are not mistaken for verified work.
