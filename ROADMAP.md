# ROADMAP.md — Product and Engineering Roadmap

## Purpose

This roadmap describes the intended evolution of the Ambulance Booking System.

> **Maintenance rule:** Update this file when priorities, milestones, release scope, dependencies, or delivery assumptions change. Dates are indicative and must not be treated as commitments without confirmation.

## Phase 0 — Discovery and Foundation

### Outcomes

- Confirm operating model and geographic scope.
- Establish repository and engineering standards.
- Define core domain language.
- Create development and staging environments.
- Approve initial security and privacy requirements.

### Exit Criteria

- Product decisions are documented.
- Core architecture is agreed.
- Local setup works for a new developer.
- CI runs successfully.

## Phase 1 — Minimum Viable Booking

### Scope

- Authentication.
- Patient profile.
- Booking creation.
- Pickup and destination.
- Booking status.
- Manual dispatcher workflow.
- Basic ambulance and driver records.
- Basic notifications.
- Audit history.

### Exit Criteria

- A test user can request a booking.
- Dispatcher can assign a vehicle.
- Driver can accept and update the trip.
- Patient can see status.
- Invalid transitions are rejected.
- Core workflows are covered by automated tests.

## Phase 2 — Operational Reliability

### Scope

- Idempotency.
- Assignment concurrency protection.
- Retryable notifications.
- Outbox events.
- Monitoring and dashboards.
- Better cancellation and exception handling.
- Document verification workflows.
- Backup and restore procedures.

### Exit Criteria

- Duplicate requests do not create duplicate bookings.
- Two dispatchers cannot assign the same ambulance.
- Failed notifications are retried and observable.
- Operational incidents can be investigated.

## Phase 3 — Payments and Partner Workflows

### Scope

- Payment provider integration.
- Receipts and refunds.
- Hospital/facility accounts.
- Organization-level access.
- Pricing configuration.
- Reconciliation reports.

### Exit Criteria

- Payment callbacks are verified.
- Payment operations are idempotent.
- Financial records are auditable.
- Partner permissions are scoped.

## Phase 4 — Scale and Automation

### Scope

- Automated dispatch assistance.
- Geospatial optimization.
- Advanced reporting.
- Search infrastructure.
- Queue-based workers.
- Service extraction only where justified by load or ownership.

### Exit Criteria

- Automation is explainable.
- Human override exists.
- Performance bottlenecks are measured.
- Operational safety controls remain intact.

## Phase 5 — Ecosystem Expansion

Possible future directions:

- Mobile applications.
- Hospital system integrations.
- Public APIs for approved partners.
- Multi-region support.
- Multi-language support.
- Advanced fleet analytics.
- Offline-friendly driver workflows.

## Prioritization Framework

Prioritize work based on:

1. Safety and correctness.
2. Security and privacy.
3. Core booking reliability.
4. Operational usefulness.
5. User experience.
6. Scalability.
7. Optional enhancements.

## Release Checklist

- [ ] Product scope approved.
- [ ] Database migrations reviewed.
- [ ] Security review completed.
- [ ] Critical workflows tested.
- [ ] Monitoring configured.
- [ ] Rollback plan documented.
- [ ] Documentation updated.
- [ ] Support and incident procedures ready.

## Changelog

- Initial roadmap.
