import type { BookingStatus } from './enums';

/**
 * The single source of truth for booking state transitions.
 * Mirrors docs/RULES.md "State Transition Rules" — any change here must be
 * accompanied by updates to RULES.md, the domain tests, and PRODUCT.md.
 */
export const BOOKING_TRANSITIONS: Readonly<Record<BookingStatus, readonly BookingStatus[]>> = {
  DRAFT: ['REQUESTED'],
  REQUESTED: ['SEARCHING', 'CANCELLED_BY_PATIENT', 'EXPIRED'],
  SEARCHING: ['ASSIGNED', 'REJECTED', 'CANCELLED_BY_OPERATOR'],
  ASSIGNED: ['DRIVER_EN_ROUTE', 'SEARCHING', 'CANCELLED_BY_OPERATOR'],
  DRIVER_EN_ROUTE: ['ARRIVED', 'CANCELLED_BY_OPERATOR'],
  ARRIVED: ['PATIENT_ONBOARD', 'CANCELLED_BY_OPERATOR'],
  PATIENT_ONBOARD: ['IN_TRANSIT'],
  IN_TRANSIT: ['COMPLETED', 'FAILED'],

  // Terminal states: no further transitions.
  COMPLETED: [],
  CANCELLED_BY_PATIENT: [],
  CANCELLED_BY_OPERATOR: [],
  EXPIRED: [],
  REJECTED: [],
  FAILED: [],
};

export const TERMINAL_BOOKING_STATUSES: readonly BookingStatus[] = (
  Object.keys(BOOKING_TRANSITIONS) as BookingStatus[]
).filter((status) => BOOKING_TRANSITIONS[status].length === 0);

export class InvalidTransitionError extends Error {
  constructor(
    public readonly from: BookingStatus,
    public readonly to: BookingStatus,
  ) {
    super(`Invalid booking transition: ${from} -> ${to}`);
    this.name = 'InvalidTransitionError';
  }
}

export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return BOOKING_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Throws InvalidTransitionError when the transition is not allowed. */
export function assertTransition(from: BookingStatus, to: BookingStatus): void {
  if (!canTransition(from, to)) {
    throw new InvalidTransitionError(from, to);
  }
}
