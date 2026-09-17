/**
 * Domain enums shared between the API and the web app.
 * Kept as string unions (not TS enums) so they can be validated with Zod
 * and survive the SQLite/PostgreSQL boundary unchanged.
 */

export const USER_ROLES = [
  'PATIENT',
  'DRIVER',
  'CREW',
  'DISPATCHER',
  'HOSPITAL_STAFF',
  'ADMIN',
  'SUPER_ADMIN',
] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_STATUSES = ['ACTIVE', 'SUSPENDED', 'DEACTIVATED'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const VERIFICATION_STATUSES = [
  'UNVERIFIED',
  'PENDING',
  'VERIFIED',
  'REJECTED',
] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

/** Booking lifecycle states (see docs/RULES.md "State Transition Rules"). */
export const BOOKING_STATUSES = [
  'DRAFT',
  'REQUESTED',
  'SEARCHING',
  'ASSIGNED',
  'DRIVER_EN_ROUTE',
  'ARRIVED',
  'PATIENT_ONBOARD',
  'IN_TRANSIT',
  'COMPLETED',
  'CANCELLED_BY_PATIENT',
  'CANCELLED_BY_OPERATOR',
  'EXPIRED',
  'REJECTED',
  'FAILED',
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const ACTIVE_BOOKING_STATUSES: readonly BookingStatus[] = [
  'DRAFT',
  'REQUESTED',
  'SEARCHING',
  'ASSIGNED',
  'DRIVER_EN_ROUTE',
  'ARRIVED',
  'PATIENT_ONBOARD',
  'IN_TRANSIT',
];

export const CANCELLATION_REASONS = [
  'NO_LONGER_NEEDED',
  'DUPLICATE_REQUEST',
  'FOUND_ALTERNATIVE_TRANSPORT',
  'WAIT_TIME_TOO_LONG',
  'OPERATIONAL_ISSUE',
  'OTHER',
] as const;
export type CancellationReason = (typeof CANCELLATION_REASONS)[number];

export const AMBULANCE_TYPES = ['BLS', 'ALS', 'ICU', 'PATIENT_TRANSPORT'] as const;
export type AmbulanceType = (typeof AMBULANCE_TYPES)[number];

export const AMBULANCE_STATUSES = [
  'AVAILABLE',
  'ON_TRIP',
  'IN_MAINTENANCE',
  'SUSPENDED',
  'OUT_OF_SERVICE',
] as const;
export type AmbulanceStatus = (typeof AMBULANCE_STATUSES)[number];

/** Statuses that permit a new assignment. Enforced server-side. */
export const ASSIGNABLE_AMBULANCE_STATUSES: readonly AmbulanceStatus[] = [
  'AVAILABLE',
];

export const DRIVER_AVAILABILITY_STATUSES = [
  'AVAILABLE',
  'ON_TRIP',
  'OFF_DUTY',
] as const;
export type DriverAvailabilityStatus = (typeof DRIVER_AVAILABILITY_STATUSES)[number];

export const ASSIGNMENT_DECISIONS = ['ACCEPTED', 'REJECTED'] as const;
export type AssignmentDecision = (typeof ASSIGNMENT_DECISIONS)[number];

export const URGENCY_CATEGORIES = ['PLANNED', 'URGENT', 'EMERGENCY'] as const;
export type UrgencyCategory = (typeof URGENCY_CATEGORIES)[number];

export const NOTIFICATION_CHANNELS = ['IN_APP', 'SMS', 'EMAIL'] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const NOTIFICATION_DELIVERY_STATUSES = [
  'PENDING',
  'SENT',
  'DELIVERED',
  'FAILED',
] as const;
export type NotificationDeliveryStatus = (typeof NOTIFICATION_DELIVERY_STATUSES)[number];

export const PAYMENT_STATUSES = [
  'PENDING',
  'AUTHORIZED',
  'CAPTURED',
  'FAILED',
  'REFUNDED',
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const BOOKING_EVENT_TYPES = [
  'BOOKING_CREATED',
  'STATUS_CHANGED',
  'AMBULANCE_ASSIGNED',
  'ASSIGNMENT_ACCEPTED',
  'ASSIGNMENT_REJECTED',
  'BOOKING_CANCELLED',
  'TRIP_STATUS_CHANGED',
  'BOOKING_COMPLETED',
  'BOOKING_FAILED',
] as const;
export type BookingEventType = (typeof BOOKING_EVENT_TYPES)[number];
