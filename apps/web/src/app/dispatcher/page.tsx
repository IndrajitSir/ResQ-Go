'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AmbulanceView, BookingStatus, BookingView, TripLocationView, TripView } from '@abs/contracts';
import { StatusBadge, UrgencyBadge } from '@/components/status-badge';
import { Alert, Card, EmptyState, RouteSummary, SkeletonList, StatCard } from '@/components/ui';
import { RequireRole } from '@/lib/guards';
import { apiFetch, isApiClientError } from '@/lib/api';
import { useRealtime } from '@/lib/use-realtime';
import { ageLabel, shortId, statusLabel } from '@/lib/format';

// Leaflet requires the DOM; lazy-load it so the console still renders on the server.
const LiveMap = dynamic(() => import('@/components/live-map'), { ssr: false });

interface FleetSummary {
  total: number;
  available: number;
  onTrip: number;
  offDuty: number;
  vehicles: AmbulanceView[];
}

interface ActiveTrip {
  bookingPublicId: string;
  status: BookingStatus;
  urgency: 'PLANNED' | 'URGENT' | 'EMERGENCY';
  pickup: { latitude: number; longitude: number; label: string; address: string };
  destination?: { latitude: number; longitude: number; label: string; address: string };
  ambulance?: { publicId: string; registrationNumber: string; type: string };
  driver?: { publicId: string; name: string };
  liveLocation?: TripLocationView;
}

interface DashboardPayload {
  fleet: FleetSummary;
  activeTrips: ActiveTrip[];
}

/** Where the map looks when nothing is moving yet. */
const DEFAULT_CENTER: [number, number] = [12.9716, 77.5946];

function DispatcherContent() {
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [queue, setQueue] = useState<BookingView[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [eligible, setEligible] = useState<AmbulanceView[]>([]);
  const [eligibleLoading, setEligibleLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [assigning, setAssigning] = useState<string | null>(null);

  const { connected: sseConnected } = useRealtime();

  const loadDashboard = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [dash, pending] = await Promise.all([
        apiFetch<DashboardPayload>('/dispatch/dashboard'),
        apiFetch<BookingView[]>('/dispatch/queue'),
      ]);
      setDashboard(dash);
      setQueue(pending);
      setError(null);
    } catch (err) {
      setError(isApiClientError(err) ? err.message : 'Could not load the dispatch console.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadEligible = useCallback(async (bookingPublicId: string, silent = false) => {
    if (!silent) setEligibleLoading(true);
    try {
      const items = await apiFetch<AmbulanceView[]>(
        `/dispatch/eligible?bookingPublicId=${encodeURIComponent(bookingPublicId)}`,
      );
      setEligible(items);
      setActionError(null);
    } catch (err) {
      setEligible([]);
      setActionError(isApiClientError(err) ? err.message : 'Could not load eligible ambulances.');
    } finally {
      setEligibleLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    if (selectedId) void loadEligible(selectedId);
    else setEligible([]);
  }, [selectedId, loadEligible]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      void loadDashboard(true);
      if (selectedId) void loadEligible(selectedId, true);
    }, 12000);
    return () => window.clearInterval(interval);
  }, [loadDashboard, loadEligible, selectedId]);

  async function assign(ambulancePublicId: string) {
    if (!selectedId) return;
    setAssigning(ambulancePublicId);
    setActionError(null);
    try {
      await apiFetch<{ booking: BookingView; trip: TripView }>(
        `/dispatch/bookings/${selectedId}/assign`,
        { method: 'POST', body: { ambulanceId: ambulancePublicId } },
      );
      setToast('Ambulance assigned. The crew has been notified.');
      setSelectedId(null);
      await loadDashboard(true);
    } catch (err) {
      setActionError(
        isApiClientError(err) ? err.message : 'Could not assign that ambulance. Please retry.',
      );
    } finally {
      setAssigning(null);
    }
  }

  const selected = queue.find((booking) => booking.publicId === selectedId) ?? null;

  const mapTarget = useMemo(() => {
    const first = dashboard?.activeTrips[0];
    if (!first) return null;
    return first.liveLocation
      ? [first.liveLocation.latitude, first.liveLocation.longitude]
      : [first.pickup.latitude, first.pickup.longitude];
  }, [dashboard]);

  return (
    <>
      <div className="page-header spread">
        <div>
          <div className="page-header__row">
            <h1 className="page-title">Dispatch console</h1>
            {sseConnected ? (
              <span className="badge badge-completed">
                <span className="live-dot" style={{ marginLeft: 0 }} />
                Live
              </span>
            ) : null}
          </div>
          <p className="subtitle">
            Emergencies first, then urgency, then how long the request has been waiting.
          </p>
        </div>
        <Link className="btn btn-secondary btn-small" href="/bookings">
          All bookings →
        </Link>
      </div>

      <p aria-live="polite" className="visually-hidden">
        {toast}
      </p>

      {error ? (
        <Alert tone="error" title="Console unavailable" onDismiss={() => setError(null)}>
          <p>{error}</p>
          <div className="btn-row btn-row--tight">
            <button type="button" className="btn btn-secondary btn-small" onClick={() => void loadDashboard()}>
              Try again
            </button>
          </div>
        </Alert>
      ) : null}

      {dashboard ? (
        <div className="stat-grid">
          <StatCard label="Total fleet" value={dashboard.fleet.total} />
          <StatCard label="Available" value={dashboard.fleet.available} tone="success" />
          <StatCard label="On trip" value={dashboard.fleet.onTrip} tone="warning" />
          <StatCard label="Unavailable" value={dashboard.fleet.offDuty} tone="muted" />
        </div>
      ) : null}

      {dashboard && dashboard.activeTrips.length > 0 ? (
        <Card className="card--flush">
          <div className="card__header">
            <h2>Active trips</h2>
            <p className="muted text-sm">
              Latest crew position reported over the live connection.
            </p>
          </div>
          <div style={{ padding: '0 var(--space-5)' }}>
            <div style={{ marginTop: 'var(--space-4)' }}>
              <LiveMap
                tall
                pickupLatitude={mapTarget?.[0] ?? DEFAULT_CENTER[0]}
                pickupLongitude={mapTarget?.[1] ?? DEFAULT_CENTER[1]}
                destinationLatitude={dashboard.activeTrips[0]?.destination?.latitude}
                destinationLongitude={dashboard.activeTrips[0]?.destination?.longitude}
                liveLocation={dashboard.activeTrips[0]?.liveLocation}
              />
            </div>
          </div>
          <div className="card__body">
            {dashboard.activeTrips.map((trip) => (
              <div className="dispatch-active-row" key={trip.bookingPublicId}>
                <span className="pub-id">{shortId(trip.bookingPublicId)}</span>
                <UrgencyBadge urgency={trip.urgency} />
                <StatusBadge status={trip.status} />
                <span className="muted">
                  {trip.driver?.name ?? 'No crew'} · {trip.ambulance?.registrationNumber ?? '—'}
                </span>
                <Link
                  href={`/bookings/${trip.bookingPublicId}`}
                  className="btn btn-ghost btn-small"
                  style={{ marginLeft: 'auto' }}
                >
                  Details →
                </Link>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {dashboard && dashboard.activeTrips.length === 0 && !loading ? (
        <EmptyState icon="map" title="No active trips">
          Every crew is idle. Active trips will appear here and on the map as soon as they are
          assigned.
        </EmptyState>
      ) : null}

      <div className="dispatch-grid">
        <section aria-labelledby="queue-heading">
          <h2 id="queue-heading">Pending requests</h2>
          {loading && queue.length === 0 ? (
            <SkeletonList rows={2} label="Loading queue" />
          ) : queue.length === 0 ? (
            <EmptyState icon="inbox" title="Queue is clear">
              New requests appear here automatically.
            </EmptyState>
          ) : (
            queue.map((booking) => {
              const isSelected = selectedId === booking.publicId;
              return (
                <Card key={booking.publicId} className={isSelected ? 'card--selected' : 'card--interactive'}>
                  <div className="spread">
                    <div className="meta-row" style={{ marginTop: 0 }}>
                      <span className="pub-id">{shortId(booking.publicId)}</span>
                      <UrgencyBadge urgency={booking.urgency} />
                      <StatusBadge status={booking.status} />
                    </div>
                    <span className="badge badge-neutral">{ageLabel(booking.createdAt)}</span>
                  </div>

                  <RouteSummary booking={booking} />

                  <div className="meta-row">
                    <span>{booking.requiredAmbulanceType}</span>
                    {booking.destinationPending ? (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>Facility to be confirmed</span>
                      </>
                    ) : null}
                  </div>

                  <div className="btn-row">
                    <button
                      type="button"
                      className={isSelected ? 'btn btn-primary btn-small' : 'btn btn-secondary btn-small'}
                      aria-pressed={isSelected}
                      onClick={() => setSelectedId(isSelected ? null : booking.publicId)}
                    >
                      {isSelected ? 'Selected' : 'Select to dispatch'}
                    </button>
                    <Link className="btn btn-ghost btn-small" href={`/bookings/${booking.publicId}`}>
                      Open
                    </Link>
                  </div>
                </Card>
              );
            })
          )}
        </section>

        <section aria-labelledby="eligible-heading">
          <h2 id="eligible-heading">Eligible ambulances</h2>
          {!selected ? (
            <EmptyState icon="ambulance" title="Select a request">
              Choose a pending request on the left to see the vehicles that can take it, nearest
              first.
            </EmptyState>
          ) : eligibleLoading ? (
            <SkeletonList rows={2} label="Loading eligible ambulances" />
          ) : (
            <>
              <p className="muted text-sm">
                For request <span className="pub-id">{shortId(selected.publicId)}</span> —{' '}
                {selected.requiredAmbulanceType}, {statusLabel(selected.status)}.
              </p>

              {actionError ? <Alert tone="error">{actionError}</Alert> : null}

              {eligible.length === 0 ? (
                <EmptyState icon="ambulance" title="No eligible vehicle">
                  No available ambulance matches the required type right now. The request stays in
                  the queue and will be offered again when one is released.
                </EmptyState>
              ) : (
                eligible.map((ambulance) => (
                  <Card key={ambulance.publicId}>
                    <div className="spread">
                      <strong>{ambulance.registrationNumber}</strong>
                      <span className="badge badge-neutral">{ambulance.type}</span>
                    </div>
                    <p className="muted text-sm" style={{ margin: 'var(--space-2) 0 0' }}>
                      {ambulance.serviceArea}
                      {ambulance.capabilities.length > 0
                        ? ` · ${ambulance.capabilities.join(', ')}`
                        : ''}
                      {ambulance.distanceKm !== undefined
                        ? ` · ${ambulance.distanceKm.toFixed(1)} km from pickup`
                        : ' · distance unknown'}
                    </p>
                    {ambulance.assignedDriverName ? (
                      <p className="muted text-sm" style={{ margin: 0 }}>
                        Crew: {ambulance.assignedDriverName}
                      </p>
                    ) : (
                      <p className="text-sm" style={{ color: 'var(--signal-warning)', margin: 0 }}>
                        No crew attached — this vehicle cannot be dispatched.
                      </p>
                    )}
                    <div className="btn-row">
                      <button
                        type="button"
                        className="btn btn-primary btn-small"
                        disabled={assigning !== null || !ambulance.assignedDriverPublicId}
                        onClick={() => void assign(ambulance.publicId)}
                      >
                        {assigning === ambulance.publicId ? 'Assigning…' : 'Assign'}
                      </button>
                    </div>
                  </Card>
                ))
              )}
            </>
          )}
        </section>
      </div>
    </>
  );
}

export default function DispatcherPage() {
  return (
    <RequireRole role={['DISPATCHER', 'ADMIN', 'SUPER_ADMIN']}>
      <DispatcherContent />
    </RequireRole>
  );
}