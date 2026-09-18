import { z } from 'zod';
import {
  AMBULANCE_TYPES,
  ASSIGNMENT_DECISIONS,
  BOOKING_STATUSES,
  CANCELLATION_REASONS,
  DRIVER_AVAILABILITY_STATUSES,
  URGENCY_CATEGORIES,
  USER_ROLES,
  VERIFICATION_STATUSES,
} from './enums';

/**
 * Validation schemas shared by the API (authoritative) and the web app
 * (usability only — the client is never a trusted source, per docs/RULES.md).
 */

export const passwordSchema = z
  .string()
  .min(10, 'Password must be at least 10 characters')
  .max(128)
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[0-9]/, 'Password must contain a digit')
  .regex(/[^A-Za-z0-9]/, 'Password must contain a special character');

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(254),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9]{7,15}$/, 'Phone must be 7-15 digits, optionally prefixed with +'),
  password: passwordSchema,
  role: z.enum(['PATIENT', 'DRIVER']).default('PATIENT'),
});
export type RegisterDto = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(128),
});
export type LoginDto = z.infer<typeof loginSchema>;

/** Geodesic coordinates in decimal degrees (WGS-84). */
export const coordinatesSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const locationSchema = z.object({
  label: z.string().trim().min(3).max(200),
  address: z.string().trim().min(5).max(300),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

/**
 * A location the requester may not have described yet. Emergency requests are
 * raised in one tap, so labels and addresses are filled server-side from the
 * device coordinates and dispatch confirms the receiving facility.
 */
export const optionalLocationSchema = z.object({
  label: z.string().trim().min(1).max(200).optional(),
  address: z.string().trim().min(1).max(300).optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const createBookingSchema = z
  .object({
    idempotencyKey: z.string().uuid({ message: 'idempotencyKey must be a UUID' }),
    pickup: optionalLocationSchema,
    destination: optionalLocationSchema.optional(),
    requiredAmbulanceType: z.enum(AMBULANCE_TYPES),
    urgency: z.enum(URGENCY_CATEGORIES).default('URGENT'),
    notes: z.string().trim().max(1000).optional(),
  })
  .superRefine((value, ctx) => {
    // Only emergency requests may be raised without describing the locations:
    // they are expected to come from the one-tap flow, which shares device
    // coordinates. Every other request must be explicit.
    if (value.urgency === 'EMERGENCY') return;
    if (!value.pickup.address) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['pickup', 'address'],
        message: 'Tell us where to collect the patient',
      });
    }
    if (!value.destination) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['destination'],
        message: 'Choose a destination, or mark the request as an emergency',
      });
    }
  });
export type CreateBookingDto = z.infer<typeof createBookingSchema>;

export const setDestinationSchema = z.object({
  destination: locationSchema,
});
export type SetDestinationDto = z.infer<typeof setDestinationSchema>;

export const cancelBookingSchema = z.object({
  reason: z.enum(CANCELLATION_REASONS),
  details: z.string().trim().max(500).optional(),
});
export type CancelBookingDto = z.infer<typeof cancelBookingSchema>;

export const assignAmbulanceSchema = z.object({
  ambulanceId: z.string().uuid(),
});
export type AssignAmbulanceDto = z.infer<typeof assignAmbulanceSchema>;

export const assignmentDecisionSchema = z.object({
  decision: z.enum(ASSIGNMENT_DECISIONS),
  reason: z.string().trim().max(500).optional(),
});
export type AssignmentDecisionDto = z.infer<typeof assignmentDecisionSchema>;

export const tripStatusUpdateSchema = z.object({
  status: z.enum([
    'DRIVER_EN_ROUTE',
    'ARRIVED',
    'PATIENT_ONBOARD',
    'IN_TRANSIT',
    'COMPLETED',
    'FAILED',
  ]),
  note: z.string().trim().max(500).optional(),
});
export type TripStatusUpdateDto = z.infer<typeof tripStatusUpdateSchema>;

/** Vehicle telemetry sent by the driver app while a trip is active. */
export const tripLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  heading: z.number().min(0).max(360).optional(),
  speedKph: z.number().min(0).max(300).optional(),
});
export type TripLocationDto = z.infer<typeof tripLocationSchema>;

export const driverAvailabilitySchema = z.object({
  status: z.enum(DRIVER_AVAILABILITY_STATUSES),
});
export type DriverAvailabilityDto = z.infer<typeof driverAvailabilitySchema>;

export const driverVerificationSchema = z
  .object({
    identityVerification: z.enum(VERIFICATION_STATUSES).optional(),
    licenseVerification: z.enum(VERIFICATION_STATUSES).optional(),
  })
  .refine(
    (value) => value.identityVerification !== undefined || value.licenseVerification !== undefined,
    { message: 'Provide at least one verification status' },
  );
export type DriverVerificationDto = z.infer<typeof driverVerificationSchema>;

export const ambulanceSchema = z.object({
  registrationNumber: z
    .string()
    .trim()
    .min(4)
    .max(20)
    .regex(/^[A-Za-z0-9-]+$/, 'Registration number may contain letters, digits and hyphens'),
  type: z.enum(AMBULANCE_TYPES),
  capabilities: z.array(z.string().trim().min(2).max(50)).max(20).default([]),
  serviceArea: z.string().trim().min(2).max(120),
  baseLatitude: z.number().min(-90).max(90).optional(),
  baseLongitude: z.number().min(-180).max(180).optional(),
});
export type AmbulanceCreateDto = z.infer<typeof ambulanceSchema>;

/**
 * Attaches a crew member to a vehicle. `null` releases the vehicle back to the
 * unassigned pool. An ambulance without a crew can never be dispatched.
 */
export const assignAmbulanceDriverSchema = z.object({
  driverPublicId: z.string().min(1).nullable(),
});
export type AssignAmbulanceDriverDto = z.infer<typeof assignAmbulanceDriverSchema>;

export const listBookingsQuerySchema = z.object({
  status: z.enum(BOOKING_STATUSES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});
export type ListBookingsQuery = z.infer<typeof listBookingsQuerySchema>;

export const rejectBookingSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});
export type RejectBookingDto = z.infer<typeof rejectBookingSchema>;

/** Roles that may be granted at self-registration. Privileged roles are provisioned internally. */
export const SELF_SERVICE_ROLES = ['PATIENT', 'DRIVER'] as const;
export const PRIVILEGED_ROLES = ['DISPATCHER', 'ADMIN', 'SUPER_ADMIN', 'HOSPITAL_STAFF', 'CREW'] as const satisfies readonly (
  typeof USER_ROLES
)[number][];
