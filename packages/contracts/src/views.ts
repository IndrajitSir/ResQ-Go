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
