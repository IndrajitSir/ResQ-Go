'use client';

import { useParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import type {
  AssignedCrewView,
  BookingEventView,
  BookingView,
  CancellationReason,
  TripLocationView,
  TripView,
} from '@abs/contracts';
import { ACTIVE_BOOKING_STATUSES, CANCELLATION_REASONS, canTransition } from '@abs/contracts';
import { StatusBadge, UrgencyBadge } from '@/components/status-badge';
import { Alert, Card, EmptyState, RouteSummary, SkeletonList } from '@/components/ui';

const LiveMap = dynamic(() => import('@/components/live-map'), { ssr: false });

import { RequireRole } from '@/lib/guards';
import { apiFetch, isApiClientError } from '@/lib/api';
import { useRealtime } from '@/lib/use-realtime';
import { CANCELLATION_REASON_LABELS, formatDate, shortId, statusLabel } from '@/lib/format';

interface DetailPayload {
  booking: BookingView;
  trip?: TripView;
  crew?: AssignedCrewView;
  liveLocation?: TripLocationView;
  distanceRemainingKm?: number;
  etaMinutes?: number;
}

const EVENT_LABELS: Record<string, string> = {
  BOOKING_CREATED: 'Booking created',
  STATUS_CHANGED: 'Status changed',
  AMBULANCE_ASSIGNED: 'Ambulance assigned',
  ASSIGNMENT_ACCEPTED: 'Assignment accepted by driver',
  ASSIGNMENT_REJECTED: 'Assignment rejected by driver',
  BOOKING_CANCELLED: 'Booking cancelled',
  TRIP_STATUS_CHANGED: 'Trip status updated',
  BOOKING_COMPLETED: 'Booking completed',
  BOOKING_FAILED: 'Booking failed',
};

/** Ordered milestones, used to render the trip stepper. */
const TRIP_STEPS: Array<{ key: keyof TripView; label: string }> = [
  { key: 'acceptedAt', label: 'Crew accepted' },
  { key: 'arrivedAt', label: 'Arrived at pickup' },
  { key: 'onboardedAt', label: 'Patient on board' },
  { key: 'completedAt', label: 'Completed' },
];

function DetailContent() {
  const params = useParams<{ id: string }>();
  const publicId = params.id;

  const [detail, setDetail] = useState<DetailPayload | null>(null);
  const [events, setEvents] = useState<BookingEventView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [liveMessage, setLiveMessage] = useState('');
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState<CancellationReason>('NO_LONGER_NEEDED');
  const [cancelDetails, setCancelDetails] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);

  const prevStatusRef = useRef<string | null>(null);
  const prevEventCount = useRef(0);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const payload = await apiFetch<DetailPayload>(`/bookings/${publicId}`);
        if (prevStatusRef.current && prevStatusRef.current !== payload.booking.status) {
          setLiveMessage(`Booking status changed to ${statusLabel(payload.booking.status)}.`);
        }
        prevStatusRef.current = payload.booking.status;
        setDetail(payload);

        const eventList = await apiFetch<BookingEventView[]>(`/bookings/${publicId}/events`);
        setEvents(eventList);
        setError(null);
      } catch (err) {
        setError(
          isApiClientError(err)
            ? err.message
            : 'We could not load this booking. Please try again.',
        );
      } finally {
        setLoading(false);
      }
    },
    [publicId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  // Server-sent events are the fast path; the poll is a safety net for
  // browsers or proxies that drop the stream.
  const { connected: sseConnected, events: realtimeEvents } = useRealtime(publicId);
  const statusActive = detail ? ACTIVE_BOOKING_STATUSES.includes(detail.booking.status) : false;

  useEffect(() => {
    if (!statusActive) return;
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load(true);
    }, 20000);
    return () => window.clearInterval(interval);
  }, [statusActive, load]);

  useEffect(() => {
    if (realtimeEvents.length > prevEventCount.current) {
      prevEventCount.current = realtimeEvents.length;
      void load(true);
    }
  }, [realtimeEvents, load]);

  async function handleCancel() {
    if (!detail) return;
    setActing(true);
    setActionError(null);
    try {
      await apiFetch<BookingView>(`/bookings/${detail.booking.publicId}/cancel`, {
        method: 'POST',
        body: {
          reason: cancelReason,
          details: cancelDetails.trim() || undefined,
        },
      });
      setShowCancel(false);
      setLiveMessage('Booking cancelled.');
      await load(true);
    } catch (err) {
      setActionError(
        isApiClientError(err) ? err.message : 'We could not cancel the booking. Please try again.',
      );
    } finally {
      setActing(false);
    }
  }

  if (loading && !detail) {
    return <SkeletonList rows={1} label="Loading booking" />;
  }

  if (error && !detail) {
    return (
      <EmptyState
        icon="inbox"
        title="Booking unavailable"
        action={
          <button type="button" className="btn btn-secondary" onClick={() => void load()}>
            Try again
          </button>
        }
      >
        {error}
      </EmptyState>
    );
  }

  if (!detail) return null;

  const { booking, trip } = detail;
  const canCancel =
    (booking.status === 'REQUESTED' || booking.status === 'SEARCHING') &&
    canTransition(booking.status, 'CANCELLED_BY_PATIENT');

  // Explicitly narrowing: `x != null` would also pass the project's eqeqeq rule
  // only by accident, and these values are genuinely optional.
  const etaMinutes = detail.etaMinutes ?? null;
  const distanceRemainingKm = detail.distanceRemainingKm ?? null;
  const hasEta = etaMinutes !== null;
  const hasDistance = distanceRemainingKm !== null;

  return (
    <>
      <p aria-live="polite" className="visually-hidden">
        {liveMessage}
      </p>

      <div className="page-header">
        <div className="page-header__row">
          <h1 className="page-title">Booking {shortId(booking.publicId, 12)}</h1>
          <StatusBadge status={booking.status} />
          <UrgencyBadge urgency={booking.urgency} />
          {sseConnected && statusActive ? (
            <span className="badge badge-completed">
              <span className="live-dot" style={{ marginLeft: 0 }} />
              Live
            </span>
          ) : null}
        </div>
      </div>

      <Card>
        <RouteSummary booking={booking} />

        {booking.destinationPending ? (
          <Alert tone="info" title="Destination pending">
            Dispatch is confirming the receiving facility. Your crew is already being dispatched —
            this does not hold up the trip.
          </Alert>
        ) : null}

        {trip && detail.liveLocation ? (
          <div style={{ marginTop: 'var(--space-4)' }}>
            <LiveMap
              pickupLatitude={booking.pickup.latitude}
              pickupLongitude={booking.pickup.longitude}
              pickupLabel={booking.pickup.label}
              destinationLatitude={booking.destination.latitude}
              destinationLongitude={booking.destination.longitude}
              destinationLabel={booking.destination.label}
              liveLocation={detail.liveLocation}
            />
          </div>
        ) : null}

        {hasDistance || hasEta ? (
          <div className="tracking-strip" style={{ marginTop: 'var(--space-4)' }}>
            {hasEta ? (
              <span className="tracking-stat">
                <strong>{Math.round(etaMinutes)} min</strong>
                estimated arrival
              </span>
            ) : null}
            {hasDistance ? (
              <span className="tracking-stat">
                <strong>{(distanceRemainingKm as number).toFixed(1)} km</strong>
                remaining
              </span>
            ) : null}
          </div>
        ) : null}

        {detail.crew ? (
          <div className="crew-card" style={{ marginTop: 'var(--space-4)' }}>
            <div className="crew-card-title">Assigned crew</div>
            <div className="crew-card-detail">
              <span>{detail.crew.driverName}</span>
              {detail.crew.driverPhone ? (
                <a href={`tel:${detail.crew.driverPhone}`} className="btn btn-secondary btn-small">
                  Call driver
                </a>
              ) : null}
            </div>
            <p className="muted text-sm" style={{ margin: 'var(--space-2) 0 0' }}>
              {detail.crew.ambulanceRegistrationNumber} · {detail.crew.ambulanceType}
            </p>
          </div>
        ) : null}

        <div className="meta-row">
          <span>Type: {booking.requiredAmbulanceType}</span>
          <span aria-hidden="true">·</span>
          <span>Created {formatDate(booking.createdAt)} UTC</span>
          <span aria-hidden="true">·</span>
          <span>Updated {formatDate(booking.updatedAt)} UTC</span>
        </div>

        {booking.notes ? (
          <p className="muted" style={{ marginTop: 'var(--space-3)' }}>
            <strong className="strong">Notes for the crew:</strong> {booking.notes}
          </p>
        ) : null}

        {booking.cancellationReason ? (
          <p className="muted">
            Cancellation reason:{' '}
            {CANCELLATION_REASON_LABELS[booking.cancellationReason] ?? booking.cancellationReason}
            {booking.cancellationDetails ? ` — ${booking.cancellationDetails}` : ''}
          </p>
        ) : null}

        {canCancel && !showCancel ? (
          <div className="btn-row">
            <button type="button" className="btn btn-danger" onClick={() => setShowCancel(true)}>
              Cancel booking
            </button>
          </div>
        ) : null}

        {showCancel ? (
          <div style={{ marginTop: 'var(--space-5)' }}>
            <h3>Cancel this booking</h3>
            {actionError ? <Alert tone="error">{actionError}</Alert> : null}
            <label className="field">
              <span>Reason</span>
              <select
                value={cancelReason}
                onChange={(event) => setCancelReason(event.target.value as CancellationReason)}
              >
                {CANCELLATION_REASONS.map((reason) => (
                  <option key={reason} value={reason}>
                    {CANCELLATION_REASON_LABELS[reason]}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Details (optional)</span>
              <textarea
                value={cancelDetails}
                onChange={(event) => setCancelDetails(event.target.value)}
                maxLength={500}
                placeholder="Anything dispatch should know…"
              />
            </label>
            <div className="btn-row">
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => void handleCancel()}
                disabled={acting}
              >
                {acting ? 'Cancelling…' : 'Confirm cancellation'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowCancel(false)}
                disabled={acting}
              >
                Keep booking
              </button>
            </div>
          </div>
        ) : null}
      </Card>

      {trip ? (
        <Card>
          <h2>Trip progress</h2>
          <ol className="trip-steps">
            {TRIP_STEPS.map((step) => {
              const reached = Boolean(trip[step.key]);
              const isLast = step.key === 'completedAt';
              const done = reached && isLast;
              return (
                <li key={step.key} data-reached={reached ? 'true' : 'false'}>
                  <span className={`step-${reached ? (done ? 'done' : 'active') : 'pending'}`}>
                    {step.label}
                  </span>
                </li>
              );
            })}
          </ol>
        </Card>
      ) : null}

      <Card>
        <h2>Event history</h2>
        {events.length === 0 ? (
          <p className="muted">No events recorded yet.</p>
        ) : (
          <ol className="timeline">
            {[...events].reverse().map((event) => (
              <li key={event.publicId}>
                <strong>{EVENT_LABELS[event.type] ?? event.type}</strong>
                {event.previousStatus && event.newStatus ? (
                  <span className="muted">
                    {' '}
                    ({statusLabel(event.previousStatus)} → {statusLabel(event.newStatus)})
                  </span>
                ) : null}
                <span className="timeline-time">{formatDate(event.createdAt)} UTC</span>
              </li>
            ))}
          </ol>
        )}
      </Card>

      <p>
        <Link href="/bookings">← Back to bookings</Link>
      </p>
    </>
  );
}

export default function BookingDetailPage() {
  return (
    <RequireRole>
      <DetailContent />
    </RequireRole>
  );
}