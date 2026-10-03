'use client';

import { useCallback, useEffect, useState } from 'react';
import type { BookingView, DriverProfileView, TripView } from '@abs/contracts';
import { StatusBadge, UrgencyBadge } from '@/components/status-badge';
import { Alert, Card, EmptyState, RouteSummary, SkeletonList } from '@/components/ui';
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
    return <SkeletonList rows={1} label="Loading driver dashboard" />;
  }

  if (error && !profile) {
    return (
      <EmptyState
        icon="inbox"
        title="Dashboard unavailable"
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
      {actionError ? <Alert tone="error">{actionError}</Alert> : null}

      <Card>
        <h2>Availability</h2>
        {profile ? (
          <>
            <p>
              You are currently{' '}
              <strong>
                {profile.availability === 'AVAILABLE'
                  ? 'available'
                  : profile.availability === 'ON_TRIP'
                    ? 'on a trip'
                    : 'off duty'}
              </strong>
              . Dispatch only assigns work to available, verified crews.
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
                className="btn btn-secondary"
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
      </Card>

      <section aria-labelledby="pending-heading">
        <h2 id="pending-heading" className="page-title">
          Pending decisions
        </h2>
        {pending.length === 0 ? (
          <EmptyState icon="inbox" title="Nothing waiting">
            New assignments will appear here for you to accept or decline.
          </EmptyState>
        ) : (
          pending.map(({ trip, booking }) => (
            <div className="card" key={trip.publicId}>
              <div className="meta-row" style={{ marginTop: 0 }}>
                <span className="pub-id">{shortId(booking.publicId)}</span>
                <UrgencyBadge urgency={booking.urgency} />
                <span>{booking.requiredAmbulanceType}</span>
              </div>
              <RouteSummary booking={booking} />
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
          <EmptyState icon="ambulance" title="No active trip">
            Accepted assignments appear here with a single next action.
          </EmptyState>
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
                <RouteSummary booking={booking} />
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
          <EmptyState icon="inbox" title="No past trips">
            Completed and cancelled trips are kept here for your records.
          </EmptyState>
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
