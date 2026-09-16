# PRODUCT.md — Product Requirements

## Product Summary

The Ambulance Booking System allows a person or authorized organization to request an ambulance, track the booking, coordinate with drivers or dispatchers, and complete the trip with an auditable record.

The product must support both emergency-oriented speed and operational safeguards. It is not a replacement for emergency medical services, clinical triage, or local emergency hotlines.

> **Maintenance rule:** Update this document whenever user roles, features, workflows, business priorities, pricing, service boundaries, or acceptance criteria change.

## Product Goals

1. Reduce the time required to request an ambulance.
2. Give patients and authorized contacts clear booking status.
3. Help dispatchers allocate suitable ambulances.
4. Give drivers a reliable workflow for accepting and completing trips.
5. Maintain accurate operational and financial records.
6. Protect sensitive personal, location, and medical information.
7. Provide an extensible foundation for hospitals, fleet operators, and partner organizations.

## Non-Goals for the First Release

- Automated medical diagnosis.
- Clinical decision-making.
- Replacing government emergency numbers.
- Fully autonomous dispatch without human oversight.
- Complex insurance settlement.
- International multi-region operation.
- Advanced predictive analytics before reliable operational data exists.

## User Roles

### Patient / Customer

Can:

- Register and authenticate.
- Request an ambulance.
- Enter pickup and destination details.
- Select ambulance requirements where supported.
- View booking status.
- Cancel according to policy.
- Contact support.
- View trip history and receipts.

### Driver / Crew

Can:

- Maintain profile and verification documents.
- Set availability.
- Receive assignment requests.
- Accept or reject assignments with a reason.
- Update trip status.
- Share location while on an active trip.
- Report incidents.
- View completed trip history.

### Dispatcher

Can:

- View incoming requests.
- Validate and prioritize operationally.
- See eligible ambulances.
- Assign or reassign trips.
- Contact drivers and patients through approved channels.
- Handle cancellations and exceptions.
- View operational metrics.

### Hospital / Facility

Can:

- Maintain facility profile.
- Indicate service capabilities.
- Receive destination or arrival information where authorized.
- Manage approved staff accounts.

### Administrator

Can:

- Manage users, roles, settings, and verification.
- Configure service areas and pricing policies.
- Review audit logs.
- Manage disputes and operational incidents.
- Access reports according to least privilege.

## Core User Journeys

### Request an Ambulance

1. User opens the booking flow.
2. System requests pickup location.
3. User enters or selects destination.
4. User selects ambulance type or requirements.
5. System displays an estimate or clearly states that pricing is pending.
6. User confirms the request.
7. System creates a booking with a unique public reference.
8. Dispatcher or dispatch engine searches for eligible ambulances.
9. User receives status updates.

### Driver Assignment

1. Dispatcher views pending requests.
2. System displays eligible vehicles and crew.
3. Dispatcher selects an ambulance.
4. Backend validates availability and prevents double assignment.
5. Driver receives the assignment.
6. Driver accepts or rejects.
7. Booking moves to the appropriate state.

### Trip Completion

1. Driver marks arrival.
2. Crew confirms patient onboarding where applicable.
3. Trip moves to in-transit.
4. Driver records destination arrival.
5. Authorized user confirms completion or dispatcher closes the trip.
6. Receipt and audit record are generated.
7. User may submit feedback.

## Functional Requirements

### Authentication

- Email or phone-based authentication.
- Strong password policy where passwords are used.
- Verification and recovery flows.
- Session revocation.
- Role-based authorization.
- Optional MFA for privileged roles.

### Booking

- Create, view, update, cancel, and track bookings.
- Validate pickup and destination.
- Prevent duplicate submissions with idempotency.
- Maintain an immutable event history.
- Support booking expiry and cancellation reasons.

### Fleet

- Ambulance registration.
- Vehicle type and capability.
- Registration and insurance document tracking.
- Availability and maintenance status.
- Crew association.
- Service area.

### Notifications

- Booking confirmation.
- Assignment.
- Driver acceptance.
- Driver en route.
- Arrival.
- Cancellation.
- Completion.
- Operational failure.

### Payments

Payments are optional for the first release. If enabled:

- Never store raw card details.
- Use a trusted payment provider.
- Record payment intent and provider references.
- Make payment operations idempotent.
- Separate payment status from trip status.

## Non-Functional Requirements

- Secure by default.
- Mobile-first responsive interface.
- Accessible keyboard and screen-reader behavior.
- Clear loading and error states.
- Reliable status updates.
- Auditable administrative actions.
- Backups and recovery procedures.
- Privacy-aware location handling.
- Documented API contracts.

## Success Metrics

Track, without exposing personal data:

- Booking completion rate.
- Median time from request to assignment.
- Median time from assignment to acceptance.
- Cancellation rate and reasons.
- Notification delivery success.
- Driver rejection rate.
- API error rate.
- Support incident volume.
- Percentage of bookings with complete audit history.

## Acceptance Criteria

A release is acceptable when:

- A valid user can request an ambulance.
- Invalid or incomplete location data is rejected.
- Unauthorized users cannot view another user's booking.
- A vehicle cannot be assigned to two active trips.
- State transitions are validated.
- Notifications do not expose sensitive information.
- Operators can resolve failed assignments.
- The system records who performed important actions.

## Product Questions to Resolve

- Which geographic area is supported first?
- Is the system for one fleet or multiple operators?
- Will payments be enabled?
- Which ambulance categories are required?
- What is the cancellation policy?
- Is hospital integration needed in version one?
- Which emergency escalation channels are legally and operationally appropriate?

## Changelog

- Initial product definition.
