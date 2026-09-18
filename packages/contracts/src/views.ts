import type {
  AmbulanceStatus,
  AmbulanceType,
  BookingStatus,
  BookingEventType,
  CancellationReason,
  DriverAvailabilityStatus,
  NotificationChannel,
  NotificationDeliveryStatus,
  UrgencyCategory,
  UserRole,
  UserStatus,
  VerificationStatus,
} from './enums';

/** Serializable views returned by the API. Public IDs are used externally. */

export interface UserView {
  publicId: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
}

export interface DriverProfileView {
  userPublicId: string;
  availability: DriverAvailabilityStatus;
  licenseVerification: VerificationStatus;
  identityVerification: VerificationStatus;
}

export interface AmbulanceView {
  publicId: string;
  registrationNumber: string;
  type: AmbulanceType;
  capabilities: string[];
  serviceArea: string;
  status: AmbulanceStatus;
  createdAt: string;
  /** Public id of the crew member currently attached to this vehicle, when known. */
  assignedDriverPublicId?: string;
  assignedDriverName?: string;
  /** Straight-line distance to the booking being dispatched, in kilometres. */
  distanceKm?: number;
}

export interface LocationView {
  label: string;
  address: string;
  latitude: number;
  longitude: number;
}

export interface BookingView {
  publicId: string;
  status: BookingStatus;
  urgency: UrgencyCategory;
  pickup: LocationView;
  destination: LocationView;
  requiredAmbulanceType: AmbulanceType;
  notes?: string;
  cancellationReason?: CancellationReason;
  cancellationDetails?: string;
  requesterPublicId: string;
  assignedAmbulancePublicId?: string;
  assignedDriverPublicId?: string;
  /**
   * True when the requester did not know the receiving facility (typical for an
   * emergency request raised in one tap). Dispatch must confirm the destination.
   */
  destinationPending?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TripView {
  publicId: string;
  bookingPublicId: string;
  ambulancePublicId: string;
  driverPublicId: string;
  acceptedAt?: string;
  arrivedAt?: string;
  onboardedAt?: string;
  completedAt?: string;
}

/** Contact details the requester may use while a crew is assigned to their trip. */
export interface AssignedCrewView {
  driverPublicId: string;
  driverName: string;
  driverPhone: string;
  ambulancePublicId: string;
  ambulanceRegistrationNumber: string;
  ambulanceType: AmbulanceType;
  ambulanceStatus: AmbulanceStatus;
  driverAvailability: DriverAvailabilityStatus;
}

/** Latest known position of a vehicle on an active trip. */
export interface TripLocationView {
  latitude: number;
  longitude: number;
  heading?: number;
  speedKph?: number;
  recordedAt: string;
}

/**
 * Everything a requester, crew member, or operator may see about one booking,
 * including live progress towards the pickup point.
 */
export interface BookingDetailView {
  booking: BookingView;
  trip?: TripView;
  crew?: AssignedCrewView;
  liveLocation?: TripLocationView;
  /** Straight-line remaining distance to the next milestone, in kilometres. */
  distanceRemainingKm?: number;
  /** Estimated minutes to the next milestone, based on current speed. */
  etaMinutes?: number;
}

export interface BookingEventView {
  publicId: string;
  type: BookingEventType;
  previousStatus?: BookingStatus;
  newStatus?: BookingStatus;
  actorPublicId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface NotificationView {
  publicId: string;
  channel: NotificationChannel;
  templateKey: string;
  body: string;
  deliveryStatus: NotificationDeliveryStatus;
  createdAt: string;
}

/** Payload embedded in JWT access tokens. */
export interface AccessTokenPayload {
  sub: string; // user public id
  role: UserRole;
}

/**
 * Server-sent events pushed to connected clients. Events are notifications of
 * state changes; REST remains the source of truth (see docs/DESIGN.md).
 */
export type RealtimeEventType =
  | 'booking.status_changed'
  | 'booking.assigned'
  | 'booking.destination_set'
  | 'trip.decision'
  | 'trip.location'
  | 'notification.created';

export interface RealtimeEvent {
  type: RealtimeEventType;
  /** Booking this event belongs to, when applicable. */
  bookingPublicId?: string;
  tripPublicId?: string;
  status?: BookingStatus;
  location?: TripLocationView;
  message?: string;
  at: string;
}
