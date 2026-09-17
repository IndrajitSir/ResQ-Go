import Link from 'next/link';
import type { BookingView } from '@abs/contracts';
import { StatusBadge, UrgencyBadge } from '@/components/status-badge';
import { formatDate, shortId } from '@/lib/format';

const TYPE_LABELS: Record<string, string> = {
  BLS: 'BLS — basic life support',
  ALS: 'ALS — advanced life support',
  ICU: 'ICU — intensive care transport',
  PATIENT_TRANSPORT: 'Patient transport (non-emergency)',
};

export function BookingCard({ booking, linkToDetail = false }: { booking: BookingView; linkToDetail?: boolean }) {
  const body = (
    <>
      <div className="meta-row" style={{ marginTop: 0 }}>
        <span className="pub-id">{shortId(booking.publicId)}</span>
        <StatusBadge status={booking.status} />
        <UrgencyBadge urgency={booking.urgency} />
      </div>
      <div className="route-summary">
        <div className="route-stop">
          <span className="route-dot" aria-hidden="true" />
          <span>
            <span className="route-label">{booking.pickup.label}</span>
            <br />
            <span className="route-address">{booking.pickup.address}</span>
          </span>
        </div>
        <div className="route-stop">
          <span className="route-dot destination" aria-hidden="true" />
          <span>
            <span className="route-label">{booking.destination.label}</span>
            <br />
            <span className="route-address">{booking.destination.address}</span>
          </span>
        </div>
      </div>
      <div className="meta-row">
        <span>{TYPE_LABELS[booking.requiredAmbulanceType] ?? booking.requiredAmbulanceType}</span>
        <span aria-hidden="true">·</span>
        <span>Requested {formatDate(booking.createdAt)} UTC</span>
      </div>
    </>
  );

  if (linkToDetail) {
    return (
      <article className="card">
        {body}
        <div className="btn-row">
          <Link className="btn btn-ghost btn-small" href={`/bookings/${booking.publicId}`}>
            View details
          </Link>
        </div>
      </article>
    );
  }

  return <article className="card">{body}</article>;
}
