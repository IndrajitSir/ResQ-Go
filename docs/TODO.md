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

- [ ] Create monorepo structure.
- [ ] Initialize Next.js application.
- [ ] Initialize NestJS application.
- [ ] Configure TypeScript strict mode.
- [ ] Configure linting and formatting.
- [ ] Add commit hooks and CI.
- [ ] Add `.env.example`.
- [ ] Add Docker Compose for local dependencies.
- [ ] Define development, staging, and production environments.

## Product Decisions

- [ ] Confirm initial operating geography.
- [ ] Confirm whether the product serves one fleet or multiple operators.
- [ ] Define ambulance categories.
- [ ] Define cancellation policy.
- [ ] Decide whether payments are included in version one.
- [ ] Define emergency escalation messaging.
- [ ] Confirm hospital integration requirements.

## Authentication and Authorization

- [ ] Implement registration and login.
- [ ] Implement verification flow.
- [ ] Implement session refresh and revocation.
- [ ] Implement role-based authorization.
- [ ] Implement resource ownership checks.
- [ ] Add privileged-role MFA.
- [ ] Add authentication rate limiting.
- [ ] Add authorization tests.

## Booking

- [ ] Create booking domain model.
- [ ] Implement booking creation.
- [ ] Add idempotency support.
- [ ] Implement booking state machine.
- [ ] Implement cancellation.
- [ ] Implement booking event history.
- [ ] Add patient booking history.
- [ ] Add booking detail page.
- [ ] Add failure and retry handling.

## Fleet and Dispatch

- [ ] Implement ambulance CRUD.
- [ ] Implement driver profile and verification.
- [ ] Implement driver availability.
- [ ] Implement eligible ambulance search.
- [ ] Implement dispatcher dashboard.
- [ ] Implement assignment locking.
- [ ] Implement driver acceptance/rejection.
- [ ] Implement reassignment workflow.
- [ ] Add maintenance and suspension states.

## Notifications and Real-Time

- [ ] Select notification providers.
- [ ] Implement notification templates.
- [ ] Implement outbox pattern.
- [ ] Add retry and dead-letter handling.
- [ ] Add WebSocket or SSE status updates.
- [ ] Add notification delivery metrics.

## Security

- [ ] Add validation to every endpoint.
- [ ] Add rate limiting.
- [ ] Add secure headers.
- [ ] Add CSRF protection where applicable.
- [ ] Add object-level authorization tests.
- [ ] Add dependency scanning.
- [ ] Add secret scanning.
- [ ] Add upload restrictions.
- [ ] Add audit logging.
- [ ] Review `Security_Vulneravility.md`.

## Quality

- [ ] Unit tests for booking transitions.
- [ ] Integration tests for assignment concurrency.
- [ ] End-to-end test for request-to-completion flow.
- [ ] Accessibility review.
- [ ] Mobile responsiveness review.
- [ ] Load test critical endpoints.
- [ ] Backup and restore test.
- [ ] Incident response checklist.

## Documentation

- [ ] Keep all project Markdown files synchronized with implementation.
- [ ] Add architecture decision records.
- [ ] Document local setup.
- [ ] Document deployment.
- [ ] Document operational runbooks.
- [ ] Record unresolved product questions.

## Changelog

- Initial backlog.
