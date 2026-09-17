'use client';

import { useCallback, useEffect, useState } from 'react';
import type { BookingView, DriverProfileView, TripView } from '@abs/contracts';
import { StatusBadge, UrgencyBadge } from '@/components/status-badge';
import { RequireRole } from '@/lib/guards';
import { apiFetch, isApiClientError } from '@/lib/api';
import { formatDate, shortId, statusLabel } from '@/lib/format';

interface TripWithBooking {
  trip: TripView;
  booking: BookingView;
}

const NEXT_ACTION: Partial<Record<string, { status: string; label: string; tone: 'primary' | 'green' | 'danger' }>> = {
  ASSIGNED: { status: 'DRIVER_EN_ROUTE', label: 'Start trip / en route', tone: 'primary' },
  DRIVER_EN_ROUTE: { status: 'ARRIVED', label: 'Mark arrival', tone: 'primary' },
  ARRIVED: { status: 'PATIENT_ONBOARD', label: 'Patient on board', tone: 'primary' },
  PATIENT_ONBOARD: { status: 'IN_TRANSIT', label: 'Start transport', tone: 'primary' },
};

function DriverContent() {
  const [profile, setProfile] = useState<DriverProfileView | null>(null);
  const [trips, setTrips] = useState<TripWithBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);
  const [rejectTripId, setRejectTripId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [profileData, tripsData] = await Promise.all([
        apiFetch<DriverProfileView>('/drivers/me'),
        apiFetch<TripWithBooking[]>('/trips/mine'),
      ]);
      setProfile(profileData);
      setTrips(tripsData);
      setError(null);
    } catch (err) {
      setError(
        isApiClientError(err) ? err.message : 'Could not load your driver dashboard. Please refresh.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        void load(true);
      }
    }, 8000);
    return () => clearInterval(interval);
  }, [load]);

  async function setAvailability(status: 'AVAILABLE' | 'OFF_DUTY') {
    setActing(true);
    setActionError(null);
    try {
      const updated = await apiFetch<DriverProfileView>('/drivers/me/availability', {
        method: 'PATCH',
        body: { status },
      });
      setProfile(updated);
      setSuccessMessage(`Availability set to ${status === 'AVAILABLE' ? 'Available' : 'Off duty'}.`);
    } catch (err) {
      setActionError(isApiClientError(err) ? err.message : 'Could not update availability.');
    } finally {
      setActing(false);
    }
  }

  async function decide(tripPublicId: string, decision: 'ACCEPTED' | 'REJECTED', reason?: string) {
    setActing(true);
    setActionError(null);
    try {
      await apiFetch<{ trip: TripView; booking: BookingView }>(
        `/trips/${tripPublicId}/decision`,
        { method: 'POST', body: { decision, reason: reason?.trim() || undefined } },
      );
      setRejectTripId(null);
      setRejectReason('');
      setSuccessMessage(
        decision === 'ACCEPTED' ? 'Assignment accepted.' : 'Assignment rejected.',
      );
      await load(true);
    } catch (err) {
      setActionError(isApiClientError(err) ? err.message : 'Could not submit your decision.');
    } finally {
      setActing(false);
    }
  }

  async function updateStatus(tripPublicId: string, status: string) {
    setActing(true);
    setActionError(null);
    try {
      await apiFetch<{ trip: TripView; booking: BookingView }>(`/trips/${tripPublicId}/status`, {
        method: 'POST',
        body: { status },
      });
      setSuccessMessage(`Trip marked as ${statusLabel(status as never)}.`);
      await load(true);
    } catch (err) {
      setActionError(isApiClientError(err) ? err.message : 'Could not update the trip status.');
    } finally {
      setActing(false);
    }
  }

  if (loading && !profile) {
    return (
      <div role="status" aria-label="Loading dashboard">
        <div className="card">
          <div className="skeleton" style={{ width: '40%' }} />
          <div className="skeleton" />
          <div className="skeleton" style={{ width: '70%' }} />
        </div>
      </div>
    );
  }

  if (error && !profile) {
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

  const pending = trips.filter((t) => !t.trip.acceptedAt && t.booking.status === 'ASSIGNED');
  const active = trips.filter(
    (t) =>
      t.trip.acceptedAt &&
      ['ASSIGNED', 'DRIVER_EN_ROUTE', 'ARRIVED', 'PATIENT_ONBOARD', 'IN_TRANSIT'].includes(
        t.booking.status,
      ),
  );
  const history = trips.filter((t) => !pending.includes(t) && !active.includes(t));

  return (
    <>
      <h1 className="page-title">Driver dashboard</h1>

      <p aria-live="polite" className="visually-hidden">
        {successMessage}
      </p>
      {actionError && (
        <div className="alert alert-error" role="alert">
          {actionError}
        </div>
      )}

      <section className="card" aria-labelledby="availability-heading">
        <h2 id="availability-heading">Availability</h2>
        {profile ? (
          <>
            <p>
              Current status:{' '}
              <strong>
                {profile.availability === 'AVAILABLE'
                  ? 'Available'
                  : profile.availability === 'ON_TRIP'
                    ? 'On trip'
                    : 'Off duty'}
              </strong>
            </p>
            <div className="btn-row">
              <button
                type="button"
                className="btn btn-primary"
                disabled={acting || profile.availability === 'AVAILABLE'}
                onClick={() => void setAvailability('AVAILABLE')}
              >
                Go available
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={acting || profile.availability === 'OFF_DUTY'}
                onClick={() => void setAvailability('OFF_DUTY')}
              >
                Go off duty
              </button>
            </div>
          </>
        ) : (
          <p className="muted">Loading availability…</p>
        )}
      </section>

      <section aria-labelledby="pending-heading">
        <h2 id="pending-heading" className="page-title">
          Pending decisions
        </h2>
        {pending.length === 0 ? (
          <p className="muted">No assignments waiting for your decision.</p>
        ) : (
          pending.map(({ trip, booking }) => (
            <div className="card" key={trip.publicId}>
              <div className="meta-row" style={{ marginTop: 0 }}>
                <span className="pub-id">{shortId(booking.publicId)}</span>
                <UrgencyBadge urgency={booking.urgency} />
                <span>{booking.requiredAmbulanceType}</span>
              </div>
              <div className="route-summary">
                <div className="route-stop">
                  <span className="route-dot" aria-hidden="true" />
                  <span>{booking.pickup.label} — {booking.pickup.address}</span>
                </div>
                <div className="route-stop">
                  <span className="route-dot destination" aria-hidden="true" />
                  <span>{booking.destination.label} — {booking.destination.address}</span>
                </div>
              </div>
              {rejectTripId === trip.publicId ? (
                <>
                  <label className="field">
                    <span>
                      Reason for rejecting <strong>(required)</strong>
                    </span>
                    <textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      maxLength={500}
                      placeholder="e.g. Vehicle maintenance issue, shift ended…"
                    />
                  </label>
                  <div className="btn-row">
                    <button
                      type="button"
                      className="btn btn-danger"
                      disabled={acting || rejectReason.trim().length < 3}
                      onClick={() => void decide(trip.publicId, 'REJECTED', rejectReason)}
                    >
                      Confirm rejection
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => {
                        setRejectTripId(null);
                        setRejectReason('');
                      }}
                    >
                      Back
                    </button>
                  </div>
                </>
              ) : (
                <div className="btn-row">
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={acting}
                    onClick={() => void decide(trip.publicId, 'ACCEPTED')}
                  >
                    Accept assignment
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    disabled={acting}
                    onClick={() => setRejectTripId(trip.publicId)}
                  >
                    Reject…
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </section>

      <section aria-labelledby="active-heading">
        <h2 id="active-heading" className="page-title">
          Active trip
        </h2>
        {active.length === 0 ? (
          <p className="muted">No active trip. Accepted assignments appear here.</p>
        ) : (
          active.map(({ trip, booking }) => {
            const action = NEXT_ACTION[booking.status];
            return (
              <div className="card" key={trip.publicId}>
                <div className="meta-row" style={{ marginTop: 0 }}>
                  <span className="pub-id">{shortId(booking.publicId)}</span>
                  <StatusBadge status={booking.status} />
                  <UrgencyBadge urgency={booking.urgency} />
                </div>
                <div className="route-summary">
                  <div className="route-stop">
                    <span className="route-dot" aria-hidden="true" />
                    <span>
                      <strong>{booking.pickup.label}</strong> — {booking.pickup.address}
                    </span>
                  </div>
                  <div className="route-stop">
                    <span className="route-dot destination" aria-hidden="true" />
                    <span>
                      <strong>{booking.destination.label}</strong> — {booking.destination.address}
                    </span>
                  </div>
                </div>
                {action && (
                  <div className="btn-row">
                    <button
                      type="button"
                      className={
                        action.tone === 'green'
                          ? 'btn btn-green'
                          : action.tone === 'danger'
                            ? 'btn btn-danger'
                            : 'btn btn-primary'
                      }
                      disabled={acting}
                      onClick={() => void updateStatus(trip.publicId, action.status)}
                    >
                      {action.label}
                    </button>
                  </div>
                )}
                {booking.status === 'IN_TRANSIT' && (
                  <div className="btn-row">
                    <button
                      type="button"
                      className="btn btn-green"
                      disabled={acting}
                      onClick={() => void updateStatus(trip.publicId, 'COMPLETED')}
                    >
                      Complete trip
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger"
                      disabled={acting}
                      onClick={() => void updateStatus(trip.publicId, 'FAILED')}
                    >
                      Mark failed
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </section>

      <section aria-labelledby="history-heading">
        <h2 id="history-heading" className="page-title">
          Trip history
        </h2>
        {history.length === 0 ? (
          <p className="muted">No past trips yet.</p>
        ) : (
          history.map(({ trip, booking }) => (
            <div className="card" key={trip.publicId}>
              <div className="meta-row" style={{ marginTop: 0 }}>
                <span className="pub-id">{shortId(booking.publicId)}</span>
                <StatusBadge status={booking.status} />
              </div>
              <div className="meta-row">
                <span>
                  {booking.pickup.label} → {booking.destination.label}
                </span>
                {trip.completedAt && <span>Completed {formatDate(trip.completedAt)} UTC</span>}
              </div>
            </div>
          ))
        )}
      </section>
    </>
  );
}

export default function DriverPage() {
  return (
    <RequireRole role={['DRIVER']}>
      <DriverContent />
    </RequireRole>
  );
}
