import type {
  AmbulanceStatus,
  AmbulanceType,
  AmbulanceView,
  AssignedCrewView,
  BookingEventView,
  BookingStatus,
  BookingView,
  CancellationReason,
  DriverAvailabilityStatus,
  DriverProfileView,
  NotificationView,
  TripLocationView,
  TripView,
  UrgencyCategory,
  UserStatus,
  UserRole,
  UserView,
  VerificationStatus,
} from '@abs/contracts';

/**
 * Structural row shapes used by the mappers (kept local so the mappers do not
 * depend on generated Prisma types at authoring time).
 */

export interface UserRow {
  publicId: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  status: string;
  createdAt: Date;
}

export interface DriverProfileRow {
  user?: { publicId: string } | null;
  availability: string;
  licenseVerification: string;
  identityVerification: string;
}

export interface AmbulanceRow {
  publicId: string;
  registrationNumber: string;
  type: string;
  capabilities: string;
  serviceArea: string;
  status: string;
  createdAt: Date;
  driver?: { publicId: string; name: string } | null;
}

export interface TripLocationRow {
  latitude: number;
  longitude: number;
  heading: number | null;
  speedKph: number | null;
  recordedAt: Date;
}

/** Crew shape shared by the patient tracking view and the dispatch console. */
export interface AssignedCrewRow {
  driver: { publicId: string; name: string; phone: string; driverProfile?: { availability: string } | null };
  ambulance: { publicId: string; registrationNumber: string; type: string; status: string };
}

export interface TripRow {
  publicId: string;
  booking?: { publicId: string } | null;
  ambulance?: { publicId: string } | null;
  driver?: { publicId: string } | null;
  acceptedAt: Date | null;
  arrivedAt: Date | null;
  onboardedAt: Date | null;
  completedAt: Date | null;
}

export interface BookingRow {
  publicId: string;
  status: string;
  urgency: string;
  pickupLabel: string;
  pickupAddress: string;
  pickupLatitude: number;
  pickupLongitude: number;
  destLabel: string;
  destAddress: string;
  destLatitude: number;
  destLongitude: number;
  requiredAmbulanceType: string;
  notes: string | null;
  destinationPending?: boolean;
  cancellationReason: string | null;
  cancellationDetails: string | null;
  requester?: { publicId: string } | null;
  trip?: (TripRow & { ambulance?: { publicId: string } | null; driver?: { publicId: string } | null }) | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface BookingEventRow {
  publicId: string;
  type: string;
  previousStatus: string | null;
  newStatus: string | null;
  actorPublicId: string | null;
  metadata: string;
  createdAt: Date;
}

export interface NotificationRow {
  publicId: string;
  channel: string;
  templateKey: string;
  body: string;
  deliveryStatus: string;
  createdAt: Date;
}

const iso = (value: Date): string => value.toISOString();

export function mapUser(row: UserRow): UserView {
  return {
    publicId: row.publicId,
    name: row.name,
    email: row.email,
    phone: row.phone,
    role: row.role as UserRole,
    status: row.status as UserStatus,
    createdAt: iso(row.createdAt),
  };
}

export function mapDriverProfile(
  row: DriverProfileRow & { user: { publicId: string } },
): DriverProfileView {
  return {
    userPublicId: row.user.publicId,
    availability: row.availability as DriverAvailabilityStatus,
    licenseVerification: row.licenseVerification as VerificationStatus,
    identityVerification: row.identityVerification as VerificationStatus,
  };
}

export function mapAmbulance(row: AmbulanceRow): AmbulanceView {
  let capabilities: string[] = [];
  try {
    const parsed: unknown = JSON.parse(row.capabilities);
    if (Array.isArray(parsed)) {
      capabilities = parsed.filter((c): c is string => typeof c === 'string');
    }
  } catch {
    capabilities = [];
  }
  const view: AmbulanceView = {
    publicId: row.publicId,
    registrationNumber: row.registrationNumber,
    type: row.type as AmbulanceType,
    capabilities,
    serviceArea: row.serviceArea,
    status: row.status as AmbulanceStatus,
    createdAt: iso(row.createdAt),
  };
  if (row.driver) {
    view.assignedDriverPublicId = row.driver.publicId;
    view.assignedDriverName = row.driver.name;
  }
  return view;
}

/** Contact details a requester or operator needs while a crew is assigned. */
export function mapAssignedCrew(row: AssignedCrewRow): AssignedCrewView {
  return {
    driverPublicId: row.driver.publicId,
    driverName: row.driver.name,
    driverPhone: row.driver.phone,
    ambulancePublicId: row.ambulance.publicId,
    ambulanceRegistrationNumber: row.ambulance.registrationNumber,
    ambulanceType: row.ambulance.type as AmbulanceType,
    ambulanceStatus: row.ambulance.status as AmbulanceStatus,
    driverAvailability: (row.driver.driverProfile?.availability ?? 'OFF_DUTY') as DriverAvailabilityStatus,
  };
}

/** Latest known vehicle position. `attributes` are omitted when unreported. */
export function mapTripLocation(row: TripLocationRow): TripLocationView {
  const view: TripLocationView = {
    latitude: row.latitude,
    longitude: row.longitude,
    recordedAt: iso(row.recordedAt),
  };
  if (row.heading !== null) view.heading = row.heading;
  if (row.speedKph !== null) view.speedKph = row.speedKph;
  return view;
}

export function mapTrip(row: TripRow): TripView {
  const view: TripView = {
    publicId: row.publicId,
    bookingPublicId: row.booking?.publicId ?? '',
    ambulancePublicId: row.ambulance?.publicId ?? '',
    driverPublicId: row.driver?.publicId ?? '',
  };
  if (row.acceptedAt) view.acceptedAt = iso(row.acceptedAt);
  if (row.arrivedAt) view.arrivedAt = iso(row.arrivedAt);
  if (row.onboardedAt) view.onboardedAt = iso(row.onboardedAt);
  if (row.completedAt) view.completedAt = iso(row.completedAt);
  return view;
}

export function mapBooking(row: BookingRow): BookingView {
  const view: BookingView = {
    publicId: row.publicId,
    status: row.status as BookingStatus,
    urgency: row.urgency as UrgencyCategory,
    pickup: {
      label: row.pickupLabel,
      address: row.pickupAddress,
      latitude: row.pickupLatitude,
      longitude: row.pickupLongitude,
    },
    destination: {
      label: row.destLabel,
      address: row.destAddress,
      latitude: row.destLatitude,
      longitude: row.destLongitude,
    },
    requiredAmbulanceType: row.requiredAmbulanceType as AmbulanceType,
    requesterPublicId: row.requester?.publicId ?? '',
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
  if (row.notes !== null && row.notes !== undefined && row.notes !== '') {
    view.notes = row.notes;
  }
  if (row.destinationPending) {
    view.destinationPending = true;
  }
  if (row.cancellationReason !== null && row.cancellationReason !== undefined) {
    view.cancellationReason = row.cancellationReason as CancellationReason;
  }
  if (row.cancellationDetails !== null && row.cancellationDetails !== undefined) {
    view.cancellationDetails = row.cancellationDetails;
  }
  if (row.trip) {
    view.assignedAmbulancePublicId = row.trip.ambulance?.publicId;
    view.assignedDriverPublicId = row.trip.driver?.publicId;
  }
  return view;
}

export function mapBookingEvent(row: BookingEventRow): BookingEventView {
  const view: BookingEventView = {
    publicId: row.publicId,
    type: row.type as BookingEventView['type'],
    createdAt: iso(row.createdAt),
  };
  if (row.previousStatus) view.previousStatus = row.previousStatus as BookingStatus;
  if (row.newStatus) view.newStatus = row.newStatus as BookingStatus;
  if (row.actorPublicId) view.actorPublicId = row.actorPublicId;
  try {
    const parsed: unknown = JSON.parse(row.metadata);
    if (parsed !== null && typeof parsed === 'object') {
      view.metadata = parsed as Record<string, unknown>;
    }
  } catch {
    // leave metadata undefined for malformed rows
  }
  return view;
}

export function mapNotification(row: NotificationRow): NotificationView {
  return {
    publicId: row.publicId,
    channel: row.channel as NotificationView['channel'],
    templateKey: row.templateKey,
    body: row.body,
    deliveryStatus: row.deliveryStatus as NotificationView['deliveryStatus'],
    createdAt: iso(row.createdAt),
  };
}
