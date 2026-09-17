import type { BookingStatus, UrgencyCategory } from '@abs/contracts';
import { statusLabel, statusTone } from '@/lib/format';

export function StatusBadge({ status }: { status: BookingStatus }) {
  return <span className={`badge badge-${statusTone(status)}`}>{statusLabel(status)}</span>;
}

export function UrgencyBadge({ urgency }: { urgency: UrgencyCategory }) {
  return <span className={`badge badge-urgency-${urgency}`}>{urgency}</span>;
}
