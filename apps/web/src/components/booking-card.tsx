import Link from 'next/link';
import type { BookingView } from '@abs/contracts';
import { RouteSummary, BookingMeta } from '@/components/ui';

const TYPE_LABELS: Record<string, string> = {
  BLS: 'Basic life support',
  ALS: 'Advanced life support',
  ICU: 'Intensive care transport',
  PATIENT_TRANSPORT: 'Patient transport',
};

interface BookingCardProps {
  booking: BookingView;
  /** Renders a "View details" affordance when true. */
  linkToDetail?: boolean;
}

export function BookingCard({ booking, linkToDetail = false }: BookingCardProps) {
  return (
    <article className={linkToDetail ? 'card card--interactive' : 'card'}>
      <BookingMeta booking={booking} />
      <RouteSummary booking={booking} />
      {booking.destinationPending ? (
        <p className="muted text-sm" style={{ marginTop: 0 }}>
          Dispatch is confirming the receiving facility.
        </p>
      ) : null}
      {linkToDetail ? (
        <div className="btn-row">
          <Link className="btn btn-secondary btn-small" href={`/bookings/${booking.publicId}`}>
            View details
          </Link>
          <span className="muted text-xs" style={{ alignSelf: 'center' }}>
            {TYPE_LABELS[booking.requiredAmbulanceType] ?? booking.requiredAmbulanceType}
          </span>
        </div>
      ) : null}
    </article>
  );
}