# RULES.md — Business and Engineering Rules

## Purpose

This file contains non-negotiable rules for the Ambulance Booking System.

> **Maintenance rule:** Update this file whenever a business rule, authorization rule, state transition, operational policy, or engineering constraint changes. Every rule change should include a reason and date.

## Safety and Emergency Disclaimer

The platform must clearly communicate that it is a booking and coordination system. It must not claim to provide emergency medical care or replace local emergency services. Emergency escalation guidance must be adapted to the operating region and reviewed by responsible stakeholders.

## Booking Rules

1. A booking must have a requester, pickup location, and service type.
2. A booking must have a unique public reference.
3. Booking creation must be idempotent.
4. A booking cannot be assigned to an unavailable ambulance.
5. An ambulance cannot have overlapping active trips.
6. A completed or cancelled booking cannot be silently reopened.
7. Every cancellation requires a reason category.
8. Every important state transition must create an event record.
9. The client cannot choose arbitrary booking status values.
10. Expired requests must be handled by a scheduled process or operator workflow.

## State Transition Rules

Allowed transitions must be explicitly defined in code.

```text
DRAFT → REQUESTED
REQUESTED → SEARCHING | CANCELLED_BY_PATIENT | EXPIRED
SEARCHING → ASSIGNED | REJECTED | CANCELLED_BY_OPERATOR
ASSIGNED → DRIVER_EN_ROUTE | CANCELLED_BY_OPERATOR
DRIVER_EN_ROUTE → ARRIVED | CANCELLED_BY_OPERATOR
ARRIVED → PATIENT_ONBOARD | CANCELLED_BY_OPERATOR
PATIENT_ONBOARD → IN_TRANSIT
IN_TRANSIT → COMPLETED | FAILED
```

If a real operation requires a transition not listed here, update this document, the domain logic, tests, and product documentation together.

## Authorization Rules

- Users may access only resources they own or are explicitly authorized to access.
- Drivers may access assigned trips and permitted driver functions.
- Dispatchers may access operational data required for their scope.
- Administrators must still be subject to audit logging.
- Role checks are not sufficient when resource ownership also matters.
- Privileged actions require server-side authorization.
- Never trust role, user ID, or permissions sent by the frontend.

## Location Rules

- Request only location data necessary for the active workflow.
- Explain why location is collected.
- Do not retain precise location longer than operationally necessary.
- Do not expose driver live location to unauthorized users.
- Use coarse location in analytics where precise location is unnecessary.
- Protect location data in logs and exports.

## Driver and Fleet Rules

- A driver must be verified before accepting production assignments.
- An ambulance must have a valid operational status.
- Maintenance or suspended vehicles cannot be assigned.
- Capability matching must be enforced when a booking requires a specific vehicle type.
- Driver rejection reasons should be recorded without punitive assumptions.

## Payment Rules

- Payment provider references are allowed; raw card data is not.
- Payment callbacks must be verified.
- Payment operations must be idempotent.
- Refunds require authorization and audit records.
- Financial records must not be deleted merely because a booking is cancelled.

## Data Rules

- Use UTC timestamps in storage.
- Store user-facing timezone information separately when needed.
- Use soft deletion only where legally and operationally appropriate.
- Do not use production personal data in development.
- Sensitive fields must be encrypted or otherwise protected where appropriate.
- Logs must avoid passwords, tokens, payment details, and unnecessary medical information.

## API Rules

- Validate all request bodies, query parameters, and route parameters.
- Use consistent error responses.
- Apply rate limits to authentication, booking, OTP, and public endpoints.
- Use pagination and maximum page sizes.
- Avoid leaking whether a sensitive account exists.
- Document breaking changes.

## Engineering Rules

- TypeScript strict mode.
- No `any` unless justified and documented.
- No secrets in source control.
- Tests must cover authorization failures and invalid transitions.
- Database schema changes require migrations.
- Avoid direct database access from controllers.
- Do not add dependencies without evaluating maintenance, security, and license implications.

## Changelog

- Initial ruleset.
