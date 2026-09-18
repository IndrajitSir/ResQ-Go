'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AmbulanceView, BookingView, TripLocationView, TripView } from '@abs/contracts';
import { StatusBadge, UrgencyBadge } from '@/components/status-badge';
import { RequireRole } from '@/lib/guards';
import { apiFetch, isApiClientError } from '@/lib/api';
import { useRealtime } from '@/lib/use-realtime';
import { ageLabel, shortId, statusLabel } from '@/lib/format';

// Leaflet requires the DOM; lazy-load it to avoid SSR crashes.
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
  status: string;
  urgency: string;
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

  // SSE for real-time updates.
  const { connected: sseConnected } = useRealtime();

  const loadDashboard = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [dash, q] = await Promise.all([
        apiFetch<DashboardPayload>('/dispatch/dashboard'),
        apiFetch<BookingView[]>('/dispatch/queue'),
      ]);
      setDashboard(dash);
      setQueue(q);
      setError(null);
    } catch (err) {
      setError(
        isApiClientError(err) ? err.message : 'Could not load the dashboard. Please refresh.',
      );
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
      setActionError(
        isApiClientError(err) ? err.message : 'Could not load eligible ambulances.',
      );
    } finally {
      setEligibleLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    if (selectedId) {
      void loadEligible(selectedId);
    } else {
      setEligible([]);
    }
  }, [selectedId, loadEligible]);

  // Poll every 10s; SSE handles fast pushes.
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        void loadDashboard(true);
        if (selectedId) void loadEligible(selectedId, true);
      }
    }, 10000);
    return () => clearInterval(interval);
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
      setToast('Ambulance assigned successfully.');
      await loadDashboard(true);
      await loadEligible(selectedId, true);
    } catch (err) {
      setActionError(
        isApiClientError(err) ? err.message : 'Could not assign the ambulance. Please try again.',
      );
    } finally {
      setAssigning(null);
    }
  }

  const selected = queue.find((b) => b.publicId === selectedId) ?? null;

  // Compute the map center from active trips or default to Bangalore.
  const mapCenter = useMemo((): [number, number] => {
    const first = dashboard?.activeTrips[0];
    if (first) {
      return first.liveLocation
        ? [first.liveLocation.latitude, first.liveLocation.longitude]
        : [first.pickup.latitude, first.pickup.longitude];
    }
    return [12.9716, 77.5946];
  }, [dashboard]);

  return (
    <>
      <h1 className="page-title">
        Dispatch console
        {sseConnected && <span className="live-dot" aria-label="Live updates connected" />}
      </h1>
      <p aria-live="polite" className="visually-hidden">
        {toast}
      </p>

      {error && (
        <div className="alert alert-error" role="alert" aria-live="assertive">
          {error}
          <div className="btn-row">
            <button type="button" className="btn btn-ghost btn-small" onClick={() => void loadDashboard()}>
              Try again
            </button>
          </div>
        </div>
      )}

      {/* Fleet summary cards */}
      {dashboard && (
        <div className="fleet-summary">
          <div className="fleet-card">
            <span className="fleet-number">{dashboard.fleet.total}</span>
            <span className="fleet-label">Total</span>
          </div>
          <div className="fleet-card fleet-available">
            <span className="fleet-number">{dashboard.fleet.available}</span>
            <span className="fleet-label">Available</span>
          </div>
          <div className="fleet-card fleet-busy">
            <span className="fleet-number">{dashboard.fleet.onTrip}</span>
            <span className="fleet-label">On trip</span>
          </div>
          <div className="fleet-card fleet-off">
            <span className="fleet-number">{dashboard.fleet.offDuty}</span>
            <span className="fleet-label">Off duty</span>
          </div>
        </div>
      )}

      {/* Live map */}
      {dashboard && dashboard.activeTrips.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '0.75rem 1rem 0' }}>
            <h2 style={{ margin: 0 }}>Active trips — live</h2>
          </div>
          <div style={{ height: 350, marginTop: '0.5rem' }}>
            <LiveMap
              pickupLatitude={mapCenter[0]}
              pickupLongitude={mapCenter[1]}
              liveLocation={dashboard.activeTrips[0]?.liveLocation}
            />
          </div>
          <div style={{ padding: '0.5rem 1rem 0.75rem' }}>
            {dashboard.activeTrips.map((trip) => (
              <div key={trip.bookingPublicId} className="dispatch-active-row">
                <span className="pub-id">{shortId(trip.bookingPublicId)}</span>
                <UrgencyBadge urgency={trip.urgency as 'EMERGENCY' | 'URGENT' | 'PLANNED'} />
                <StatusBadge status={trip.status as never} />
                <span className="muted">
                  {trip.driver?.name ?? '—'} · {trip.ambulance?.registrationNumber ?? '—'}
                </span>
                <Link href={`/bookings/${trip.bookingPublicId}`} className="btn btn-ghost btn-small">
                  Details →
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {dashboard && dashboard.activeTrips.length === 0 && !loading && (
        <div className="card empty-state">
          <h3>No active trips</h3>
          <p>All ambulances are idle. Active trips will appear on the map.</p>
        </div>
      )}

      <p>
        <Link href="/bookings">View all bookings →</Link>
      </p>

      <div className="dispatch-grid">
        <section aria-labelledby="queue-heading">
          <h2 id="queue-heading">Pending requests</h2>
          {loading && queue.length === 0 ? (
            <div role="status" aria-label="Loading queue">
              <div className="card">
                <div className="skeleton" />
                <div className="skeleton" style={{ width: '70%' }} />
              </div>
            </div>
          ) : queue.length === 0 ? (
            <div className="card empty-state">
              <h3>Queue is clear</h3>
              <p>No pending requests right now. New bookings will appear here automatically.</p>
            </div>
          ) : (
            queue.map((booking) => (
              <div
                className="card"
                key={booking.publicId}
                style={{
                  borderColor: selectedId === booking.publicId ? 'var(--color-primary)' : undefined,
                  borderWidth: selectedId === booking.publicId ? 2 : 1,
                }}
              >
                <div className="meta-row" style={{ marginTop: 0 }}>
                  <span className="pub-id">{shortId(booking.publicId)}</span>
                  <UrgencyBadge urgency={booking.urgency} />
                  <span>{booking.requiredAmbulanceType}</span>
                  <span className="muted">{ageLabel(booking.createdAt)}</span>
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
                <div className="btn-row">
                  <button
                    type="button"
                    className="btn btn-ghost btn-small"
                    aria-pressed={selectedId === booking.publicId}
                    onClick={() =>
                      setSelectedId((prev) => (prev === booking.publicId ? null : booking.publicId))
                    }
                  >
                    {selectedId === booking.publicId ? 'Selected' : 'Select for dispatch'}
                  </button>
                </div>
              </div>
            ))
          )}
        </section>

        <section aria-labelledby="eligible-heading">
          <h2 id="eligible-heading">Eligible ambulances</h2>
          {!selected ? (
            <p className="muted">Select a pending request to see eligible ambulances.</p>
          ) : eligibleLoading ? (
            <div role="status" aria-label="Loading eligible ambulances">
              <div className="card">
                <div className="skeleton" />
                <div className="skeleton" style={{ width: '60%' }} />
              </div>
            </div>
          ) : (
            <>
              <p className="muted">
                For request <span className="pub-id">{shortId(selected.publicId)}</span> ({selected.requiredAmbulanceType},{' '}
                {selected.urgency}):
              </p>
              {actionError && (
                <div className="alert alert-error" role="alert" aria-live="assertive">
                  {actionError}
                </div>
              )}
              {eligible.length === 0 ? (
                <div className="card empty-state">
                  <h3>No eligible ambulances</h3>
                  <p>
                    No available ambulance matches the required type and service area for this
                    request.
                  </p>
                </div>
              ) : (
                eligible.map((ambulance) => (
                  <div className="card" key={ambulance.publicId}>
                    <div className="meta-row" style={{ marginTop: 0 }}>
                      <strong>{ambulance.registrationNumber}</strong>
                      <span>{ambulance.type}</span>
                    </div>
                    <p className="muted" style={{ margin: '0.25rem 0' }}>
                      Service area: {ambulance.serviceArea}
                      {ambulance.capabilities.length > 0 && (
                        <>
                          {' '}
                          · Capabilities: {ambulance.capabilities.join(', ')}
                        </>
                      )}
                    </p>
                    <div className="btn-row">
                      <button
                        type="button"
                        className="btn btn-primary btn-small"
                        disabled={assigning !== null}
                        onClick={() => void assign(ambulance.publicId)}
                      >
                        {assigning === ambulance.publicId ? 'Assigning…' : 'Assign'}
                      </button>
                    </div>
                  </div>
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
