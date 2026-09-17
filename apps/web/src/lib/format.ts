import type { BookingStatus } from '@abs/contracts';
import { ACTIVE_BOOKING_STATUSES } from '@abs/contracts';

const dateFormatter = new Intl.DateTimeFormat('en', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'UTC',
});

/** UTC-safe formatting (API timestamps are ISO strings). */
export function formatDate(iso: string | undefined | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return dateFormatter.format(date);
}

const STATUS_LABELS: Record<BookingStatus, string> = {
  DRAFT: 'Draft',
  REQUESTED: 'Requested',
  SEARCHING: 'Searching for ambulance',
  ASSIGNED: 'Ambulance assigned',
  DRIVER_EN_ROUTE: 'Driver en route',
  ARRIVED: 'Driver arrived',
  PATIENT_ONBOARD: 'Patient on board',
  IN_TRANSIT: 'In transit',
  COMPLETED: 'Completed',
  CANCELLED_BY_PATIENT: 'Cancelled by patient',
  CANCELLED_BY_OPERATOR: 'Cancelled by operator',
  EXPIRED: 'Expired',
  REJECTED: 'Rejected',
  FAILED: 'Failed',
};

export function statusLabel(status: BookingStatus): string {
  return STATUS_LABELS[status] ?? status;
}

export type StatusTone = 'active' | 'completed' | 'bad' | 'pending';

/** CSS class suffix for a status: active=teal, completed=green, cancelled/failed=red, pending=amber. */
export function statusTone(status: BookingStatus): StatusTone {
  if (ACTIVE_BOOKING_STATUSES.includes(status)) {
    return status === 'REQUESTED' || status === 'SEARCHING' ? 'pending' : 'active';
  }
  if (status === 'COMPLETED') return 'completed';
  if (
    status === 'CANCELLED_BY_PATIENT' ||
    status === 'CANCELLED_BY_OPERATOR' ||
    status === 'FAILED' ||
    status === 'REJECTED'
  ) {
    return 'bad';
  }
  return 'pending'; // EXPIRED, DRAFT
}

export const CANCELLATION_REASON_LABELS: Record<string, string> = {
  NO_LONGER_NEEDED: 'No longer needed',
  DUPLICATE_REQUEST: 'Duplicate request',
  FOUND_ALTERNATIVE_TRANSPORT: 'Found alternative transport',
  WAIT_TIME_TOO_LONG: 'Wait time too long',
  OPERATIONAL_ISSUE: 'Operational issue',
  OTHER: 'Other',
};

/** Truncated monospace-friendly public id, e.g. bk_1a2b…9z. */
export function shortId(publicId: string, keep = 8): string {
  if (publicId.length <= keep * 2 + 1) return publicId;
  return `${publicId.slice(0, keep)}…${publicId.slice(-4)}`;
}

export function ageLabel(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return '';
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return `${days} d ago`;
}
