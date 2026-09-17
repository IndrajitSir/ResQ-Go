import { canTransition, assertTransition, InvalidTransitionError } from '@abs/contracts';
import type { BookingStatus } from '@abs/contracts';

/** Every allowed pair from docs/RULES.md "State Transition Rules". */
const ALLOWED_PAIRS: ReadonlyArray<readonly [BookingStatus, BookingStatus]> = [
  ['DRAFT', 'REQUESTED'],
  ['REQUESTED', 'SEARCHING'],
  ['REQUESTED', 'CANCELLED_BY_PATIENT'],
  ['REQUESTED', 'EXPIRED'],
  ['SEARCHING', 'ASSIGNED'],
  ['SEARCHING', 'REJECTED'],
  ['SEARCHING', 'CANCELLED_BY_OPERATOR'],
  ['ASSIGNED', 'DRIVER_EN_ROUTE'],
  ['ASSIGNED', 'CANCELLED_BY_OPERATOR'],
  ['DRIVER_EN_ROUTE', 'ARRIVED'],
  ['DRIVER_EN_ROUTE', 'CANCELLED_BY_OPERATOR'],
  ['ARRIVED', 'PATIENT_ONBOARD'],
  ['ARRIVED', 'CANCELLED_BY_OPERATOR'],
  ['PATIENT_ONBOARD', 'IN_TRANSIT'],
  ['IN_TRANSIT', 'COMPLETED'],
  ['IN_TRANSIT', 'FAILED'],
];

const TERMINAL: readonly BookingStatus[] = [
  'COMPLETED',
  'CANCELLED_BY_PATIENT',
  'CANCELLED_BY_OPERATOR',
  'EXPIRED',
  'REJECTED',
  'FAILED',
];

describe('booking state machine', () => {
  describe('allowed transitions', () => {
    it.each(ALLOWED_PAIRS.map(([from, to]) => [`${from}->${to}`, from, to] as const))(
      'allows %s',
      (_label, from, to) => {
        expect(canTransition(from, to)).toBe(true);
        expect(() => assertTransition(from, to)).not.toThrow();
      },
    );
  });

  describe('rejected transitions', () => {
    it('rejects DRAFT -> COMPLETED', () => {
      expect(canTransition('DRAFT', 'COMPLETED')).toBe(false);
      expect(() => assertTransition('DRAFT', 'COMPLETED')).toThrow(InvalidTransitionError);
    });

    it('rejects every transition out of COMPLETED', () => {
      for (const to of ALLOWED_PAIRS.map(([, to]) => to)) {
        expect(canTransition('COMPLETED', to)).toBe(false);
      }
      expect(() => assertTransition('COMPLETED', 'REQUESTED')).toThrow(InvalidTransitionError);
    });

    it('rejects IN_TRANSIT -> CANCELLED_BY_OPERATOR', () => {
      expect(canTransition('IN_TRANSIT', 'CANCELLED_BY_OPERATOR')).toBe(false);
      expect(() => assertTransition('IN_TRANSIT', 'CANCELLED_BY_OPERATOR')).toThrow(
        InvalidTransitionError,
      );
    });

    it('rejects ASSIGNED -> COMPLETED', () => {
      expect(canTransition('ASSIGNED', 'COMPLETED')).toBe(false);
      expect(() => assertTransition('ASSIGNED', 'COMPLETED')).toThrow(InvalidTransitionError);
    });

    it('rejects ARRIVED -> IN_TRANSIT', () => {
      expect(canTransition('ARRIVED', 'IN_TRANSIT')).toBe(false);
      expect(() => assertTransition('ARRIVED', 'IN_TRANSIT')).toThrow(InvalidTransitionError);
    });

    it.each(TERMINAL.map((status) => [status] as const))(
      'terminal status %s has no outgoing transitions',
      (status) => {
        for (const to of ALLOWED_PAIRS.map(([, t]) => t)) {
          expect(canTransition(status, to)).toBe(false);
        }
        expect(() => assertTransition(status, 'REQUESTED')).toThrow(InvalidTransitionError);
      },
    );

    it('InvalidTransitionError carries from and to', () => {
      try {
        assertTransition('IN_TRANSIT', 'CANCELLED_BY_OPERATOR');
        fail('expected InvalidTransitionError');
      } catch (error) {
        expect(error).toBeInstanceOf(InvalidTransitionError);
        const transitionError = error as InvalidTransitionError;
        expect(transitionError.from).toBe('IN_TRANSIT');
        expect(transitionError.to).toBe('CANCELLED_BY_OPERATOR');
      }
    });
  });
});
