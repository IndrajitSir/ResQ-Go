# DATA_MODEL.md — Data Model and Persistence Strategy

## Purpose

This document defines the conceptual data model and the responsibilities of each data store.

> **Maintenance rule:** Update this file whenever an entity, relationship, field, index, retention policy, database technology, or data ownership boundary changes. Keep diagrams and migrations aligned with the actual implementation.

## Database Strategy

Different databases may be used for different purposes, but the system must maintain a clear source of truth.

### Recommended Initial Allocation

| Technology | Purpose | Source of truth? |
|---|---|---|
| PostgreSQL | Transactional domain data | Yes |
| Redis | Cache, locks, queues, rate limits | No |
| Object storage | Documents and media | No, metadata is in PostgreSQL |
| Search engine | Optional search indexes | No |
| Analytics warehouse | Aggregated reporting | No |

A different database may be selected if the team documents the trade-off.

## Core Entities

### User

Represents an authenticated person.

Important fields:

- `id`
- `public_id`
- `name`
- `email` or `phone`
- `password_hash` if applicable
- `status`
- `verification_status`
- `created_at`
- `updated_at`
- `deleted_at`

Never store plaintext passwords or authentication tokens.

### Role and Permission

Supports role-based and resource-based authorization.

Possible roles:

- PATIENT
- DRIVER
- CREW
- DISPATCHER
- HOSPITAL_STAFF
- ADMIN
- SUPER_ADMIN

Permissions should be explicit and scoped. Avoid embedding all authorization logic in role names.

### Patient Profile

- `user_id`
- emergency contact references
- optional non-diagnostic preferences
- consent and privacy settings

Do not collect clinical information unless there is a documented product and legal requirement.

### Driver Profile

- `user_id`
- license verification status
- identity verification status
- employment or operator association
- availability status
- verification timestamps

Sensitive verification documents should be stored in object storage with restricted access.

### Ambulance

- `id`
- `public_id`
- registration number
- ambulance type
- capability set
- operator organization
- status
- current location reference, if applicable
- maintenance status
- created and updated timestamps

### Hospital / Facility

- `id`
- name
- address
- geospatial coordinates
- capabilities
- operating status
- contact information
- verification status

### Booking

- `id`
- `public_id`
- requester user ID
- pickup location
- destination location
- ambulance requirement
- urgency category, if supported
- status
- cancellation reason
- estimate reference
- created and updated timestamps

Do not use a mutable human-readable booking reference as the primary database key.

### Trip

A trip represents the operational execution of a booking.

- `id`
- `booking_id`
- ambulance ID
- driver or crew references
- accepted timestamp
- arrival timestamp
- onboarding timestamp
- completion timestamp
- start and end locations
- trip status

### Booking Event

An append-only event history:

- `id`
- `booking_id`
- event type
- previous status
- new status
- actor user ID
- metadata
- created timestamp

Metadata must be filtered to avoid sensitive data leakage.

### Notification

- `id`
- recipient user ID
- channel
- template key
- delivery status
- provider reference
- retry count
- sent and delivered timestamps

### Payment

- `id`
- booking or trip ID
- provider
- provider payment reference
- amount
- currency
- status
- refund reference
- timestamps

### Audit Log

- `id`
- actor user ID
- action
- resource type
- resource public ID
- request ID
- IP metadata where justified
- result
- timestamp

Audit records should be append-only for normal application users.

## Relationships

```text
User ──< Booking
User ──< Notification
User ──< AuditLog
User ──< DriverProfile
Ambulance ──< Trip
Booking ──1 Trip (usually, unless multi-leg trips are introduced)
Booking ──< BookingEvent
Booking ──< Payment
Hospital ──< Booking as destination
Operator ──< Ambulance
```

## Indexing Guidance

Consider indexes on:

- User email/phone.
- Booking public ID.
- Booking requester and created time.
- Booking status and created time.
- Active trip ambulance ID.
- Driver availability.
- Ambulance status and service area.
- Booking event booking ID and created time.
- Notification recipient and status.
- Audit resource and timestamp.

Add indexes based on query plans, not assumptions.

## Consistency Requirements

Use transactions or equivalent atomic operations for:

- Booking creation with its initial event.
- Ambulance assignment.
- Releasing an ambulance.
- Payment state updates.
- Idempotency record creation.
- Critical status transitions.

Use distributed locks or database constraints when multiple workers may compete for the same ambulance.

## Retention and Deletion

Define retention periods with legal and operational stakeholders. At minimum:

- Operational records must remain available for support and reconciliation.
- Precise location should have a shorter retention period where possible.
- Documents require expiration and deletion workflows.
- Audit logs should not be casually deleted.
- User deletion should distinguish account deactivation, anonymization, and legal retention.

## Data Migration Rules

- Every schema change must have a migration.
- Migrations must be reviewed before production.
- Backups must be verified before destructive migrations.
- Large migrations should be backward-compatible and staged.
- Update this document after applying a structural change.

## Changelog

- Initial conceptual model.
