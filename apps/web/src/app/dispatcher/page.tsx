'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { AmbulanceView, BookingView, TripView } from '@abs/contracts';
import { StatusBadge, UrgencyBadge } from '@/components/status-badge';
import { RequireRole } from '@/lib/guards';
import { apiFetch, isApiClientError } from '@/lib/api';
import { ageLabel, shortId } from '@/lib/format';

function DispatcherContent() {
  const [queue, setQueue] = useState<BookingView[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [eligible, setEligible] = useState<AmbulanceView[]>([]);
  const [eligibleLoading, setEligibleLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [assigning, setAssigning] = useState<string | null>(null);

  const loadQueue = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const items = await apiFetch<BookingView[]>('/dispatch/queue');
      setQueue(items);
      setError(null);
    } catch (err) {
      setError(
        isApiClientError(err) ? err.message : 'Could not load the dispatch queue. Please refresh.',
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
    void loadQueue();
  }, [loadQueue]);

  useEffect(() => {
    if (selectedId) {
      void loadEligible(selectedId);
    } else {
      setEligible([]);
    }
  }, [selectedId, loadEligible]);

  // Poll every 10s while the tab is visible.
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        void loadQueue(true);
        if (selectedId) void loadEligible(selectedId, true);
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [loadQueue, loadEligible, selectedId]);

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
      await loadQueue(true);
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

  return (
    <>
      <h1 className="page-title">Dispatch console</h1>
      <p aria-live="polite" className="visually-hidden">
        {toast}
      </p>

      {error && (
        <div className="alert alert-error" role="alert" aria-live="assertive">
          {error}
          <div className="btn-row">
            <button type="button" className="btn btn-ghost btn-small" onClick={() => void loadQueue()}>
              Try again
            </button>
          </div>
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
