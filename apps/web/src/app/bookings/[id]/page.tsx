'use client';

import { useParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import type { AssignedCrewView, BookingEventView, BookingView, CancellationReason, TripLocationView, TripView } from '@abs/contracts';
import { ACTIVE_BOOKING_STATUSES, CANCELLATION_REASONS, canTransition } from '@abs/contracts';
import { StatusBadge, UrgencyBadge } from '@/components/status-badge';

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
            : 'Could not load the booking. Please try refreshing.',
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

  // Real-time: SSE pushes trigger a silent re-fetch so the UI stays current
  // without the 8-second poll. We keep a fallback poll for browsers that
  // can't do EventSource (very rare) and as a safety net.
  const { connected: sseConnected, events: rtEvents } = useRealtime(publicId);
  const statusActive = detail ? ACTIVE_BOOKING_STATUSES.includes(detail.booking.status) : false;
  useEffect(() => {
    if (!statusActive) return;
    // Fallback poll every 20s (SSE handles the fast path).
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        void load(true);
      }
    }, 20000);
    return () => clearInterval(interval);
  }, [statusActive, load]);

  // Re-fetch whenever SSE delivers a new event for this booking.
  const prevEventCount = useRef(0);
  useEffect(() => {
    if (rtEvents.length > prevEventCount.current) {
      prevEventCount.current = rtEvents.length;
      void load(true);
    }
  }, [rtEvents, load]);

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
        isApiClientError(err) ? err.message : 'Could not cancel the booking. Please try again.',
      );
    } finally {
      setActing(false);
    }
  }

  if (loading && !detail) {
    return (
      <div role="status" aria-label="Loading booking">
        <div className="card">
          <div className="skeleton" style={{ width: '50%' }} />
          <div className="skeleton" />
          <div className="skeleton" style={{ width: '80%' }} />
          <div className="skeleton" style={{ width: '40%' }} />
        </div>
      </div>
    );
  }

  if (error && !detail) {
    return (
      <div className="alert alert-error" role="alert" aria-live="assertive">
        {error}
        <div className="btn-row">
          <button type="button" className="btn btn-ghost btn-small" onClick={() => void load()}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!detail) return null;

  const { booking, trip } = detail;
  const canCancel =
    (booking.status === 'REQUESTED' || booking.status === 'SEARCHING') &&
    canTransition(booking.status, 'CANCELLED_BY_PATIENT');

  return (
    <>
      <p aria-live="polite" className="visually-hidden">
        {liveMessage}
      </p>

      <div className="card">
        <div className="meta-row" style={{ marginTop: 0 }}>
          <span className="pub-id" style={{ fontSize: '1rem' }}>
            {shortId(booking.publicId, 12)}
          </span>
          <StatusBadge status={booking.status} />
          <UrgencyBadge urgency={booking.urgency} />
          {sseConnected && statusActive && (
            <span className="live-dot" aria-label="Live updates connected" />
          )}
        </div>
        <div className="route-summary" style={{ marginTop: '0.75rem' }}>
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
        {booking.destinationPending && (
          <div className="alert" style={{ marginTop: '0.75rem' }}>
            <strong>Destination pending</strong> — dispatch is confirming the receiving facility. Your ambulance is on the way.
          </div>
        )}

        {/* Live map — shows when there's a trip and the crew is en route or beyond */}
        {trip && detail.liveLocation && (
          <div style={{ marginTop: '0.75rem' }}>
            <LiveMap
              pickupLatitude={booking.pickup.latitude}
              pickupLongitude={booking.pickup.longitude}
              pickupLabel={booking.pickup.label}
              liveLocation={detail.liveLocation}
            />
          </div>
        )}

        {(detail.distanceRemainingKm != null || detail.etaMinutes != null) && (
          <div className="tracking-strip" style={{ marginTop: '0.75rem' }}>
            {detail.etaMinutes != null && (
              <span className="tracking-stat">
                <strong>{Math.round(detail.etaMinutes)} min</strong> ETA
              </span>
            )}
            {detail.distanceRemainingKm != null && (
              <span className="tracking-stat">
                <strong>{detail.distanceRemainingKm.toFixed(1)} km</strong> remaining
              </span>
            )}
          </div>
        )}

        {detail.crew && (
          <div className="crew-card" style={{ marginTop: '0.75rem' }}>
            <div className="crew-card-title">Assigned crew</div>
            <div className="crew-card-detail">
              <strong>{detail.crew.driverName}</strong>
              {detail.crew.driverPhone && (
                <a href={`tel:${detail.crew.driverPhone}`} className="btn btn-ghost btn-small">
                  Call driver
                </a>
              )}
            </div>
            <div className="muted" style={{ marginTop: '0.25rem' }}>
              {detail.crew.ambulanceRegistrationNumber} · {detail.crew.ambulanceType}
            </div>
          </div>
        )}
        <div className="meta-row">
          <span>Type: {booking.requiredAmbulanceType}</span>
          <span aria-hidden="true">·</span>
          <span>Created {formatDate(booking.createdAt)} UTC</span>
          <span aria-hidden="true">·</span>
          <span>Updated {formatDate(booking.updatedAt)} UTC</span>
        </div>
        {booking.notes && <p className="muted">Notes: {booking.notes}</p>}
        {booking.cancellationReason && (
          <p className="muted">
            Cancellation reason: {CANCELLATION_REASON_LABELS[booking.cancellationReason] ?? booking.cancellationReason}
            {booking.cancellationDetails ? ` — ${booking.cancellationDetails}` : ''}
          </p>
        )}

        {canCancel && !showCancel && (
          <div className="btn-row">
            <button type="button" className="btn btn-danger" onClick={() => setShowCancel(true)}>
              Cancel booking
            </button>
          </div>
        )}

        {showCancel && (
          <div style={{ marginTop: '1rem' }}>
            <h3>Cancel this booking</h3>
            <label className="field">
              <span>Reason</span>
              <select
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value as CancellationReason)}
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
                onChange={(e) => setCancelDetails(e.target.value)}
                maxLength={500}
                placeholder="Anything dispatch should know…"
              />
            </label>
            {actionError && (
              <div className="alert alert-error" role="alert" aria-live="assertive">
                {actionError}
              </div>
            )}
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
                className="btn btn-ghost"
                onClick={() => setShowCancel(false)}
                disabled={acting}
              >
                Keep booking
              </button>
            </div>
          </div>
        )}
      </div>

      {trip && (
        <div className="card">
          <h2>Trip progress</h2>
          <div className="meta-row" style={{ marginTop: 0 }}>
            {trip.acceptedAt && (
              <span className={trip.completedAt ? 'step-done' : 'step-active'}>Accepted</span>
            )}
            {trip.arrivedAt && (
              <span className={trip.completedAt ? 'step-done' : 'step-active'}>Arrived at pickup</span>
            )}
            {trip.onboardedAt && (
              <span className={trip.completedAt ? 'step-done' : 'step-active'}>Patient on board</span>
            )}
            {trip.completedAt && (
              <span className="step-done">Completed</span>
            )}
          </div>

        </div>
      )}

      <div className="card">
        <h2>Event history</h2>
        {events.length === 0 ? (
          <p className="muted">No events recorded yet.</p>
        ) : (
          <ol className="timeline">
            {[...events].reverse().map((event) => (
              <li key={event.publicId}>
                <strong>{EVENT_LABELS[event.type] ?? event.type}</strong>
                {event.previousStatus && event.newStatus && (
                  <span className="muted">
                    {' '}
                    ({statusLabel(event.previousStatus)} → {statusLabel(event.newStatus)})
                  </span>
                )}
                <span className="timeline-time">{formatDate(event.createdAt)} UTC</span>
              </li>
            ))}
          </ol>
        )}
      </div>

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
