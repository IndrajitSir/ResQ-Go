'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { BookingStatus, BookingView, Paginated } from '@abs/contracts';
import { BOOKING_STATUSES } from '@abs/contracts';
import { BookingCard } from '@/components/booking-card';
import { RequireRole } from '@/lib/guards';
import { apiFetch, isApiClientError } from '@/lib/api';
import { Alert, EmptyState, SkeletonList } from '@/components/ui';
import { statusLabel } from '@/lib/format';

type StatusFilter = BookingStatus | 'ALL';

function BookingsContent() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<BookingView> | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [firstLoadDone, setFirstLoadDone] = useState(false);

  // Stops a slow first request from overwriting a newer result.
  const requestIdRef = useRef(0);

  const load = useCallback(
    async (silent = false) => {
      const requestId = ++requestIdRef.current;
      if (silent) setRefreshing(true);
      else setLoading(true);

      try {
        const params = new URLSearchParams();
        if (statusFilter !== 'ALL') params.set('status', statusFilter);
        params.set('page', String(page));
        params.set('pageSize', '10');

        const payload = await apiFetch<Paginated<BookingView>>(`/bookings?${params.toString()}`);
        if (requestId !== requestIdRef.current) return;
        setData(payload);
        setError(null);
      } catch (err) {
        if (requestId !== requestIdRef.current) return;
        setError(
          isApiClientError(err) ? err.message : 'We could not load your bookings right now.',
        );
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
          setRefreshing(false);
          setFirstLoadDone(true);
        }
      }
    },
    [statusFilter, page],
  );

  useEffect(() => {
    void load();
  }, [load]);

  // Background refresh; only while the tab is actually visible.
  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load(true);
    }, 15000);
    return () => window.clearInterval(interval);
  }, [load]);

  const totalPages = data?.totalPages ?? 1;
  const isEmpty = firstLoadDone && !loading && !error && (data?.items.length ?? 0) === 0;

  return (
    <>
      <div className="page-header spread">
        <div>
          <h1 className="page-title">Bookings</h1>
          <p className="subtitle">
            {data
              ? `${data.total} booking${data.total === 1 ? '' : 's'} · updated ${
                  refreshing ? 'just now' : 'automatically'
                }`
              : 'Loading your bookings…'}
          </p>
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-small"
          onClick={() => void load(true)}
          disabled={refreshing}
        >
          Refresh
        </button>
      </div>

      {/* A filter that stays usable on a phone, where a chip row would wrap
          into an unusable height. */}
      <div className="filter-bar">
        <label className="field" style={{ margin: 0, minWidth: '15rem' }}>
          <span className="visually-hidden">Filter by status</span>
          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value as StatusFilter);
              setPage(1);
            }}
          >
            <option value="ALL">All statuses</option>
            {BOOKING_STATUSES.map((status) => (
              <option key={status} value={status}>
                {statusLabel(status)}
              </option>
            ))}
          </select>
        </label>
        {statusFilter !== 'ALL' ? (
          <button
            type="button"
            className="btn btn-ghost btn-small"
            onClick={() => {
              setStatusFilter('ALL');
              setPage(1);
            }}
          >
            Clear filter
          </button>
        ) : null}
      </div>

      <p aria-live="polite" className="visually-hidden">
        {refreshing ? 'Refreshing bookings' : ''}
      </p>

      {error ? (
        <Alert
          tone="error"
          title="Could not load bookings"
          onDismiss={() => setError(null)}
        >
          <p>{error}</p>
          <div className="btn-row btn-row--tight">
            <button type="button" className="btn btn-secondary btn-small" onClick={() => void load()}>
              Try again
            </button>
          </div>
        </Alert>
      ) : null}

      {loading && !firstLoadDone ? (
        <SkeletonList rows={3} label="Loading bookings" />
      ) : isEmpty ? (
        <EmptyState
          icon="inbox"
          title={statusFilter === 'ALL' ? 'No bookings yet' : 'Nothing matches that filter'}
          action={
            statusFilter === 'ALL' ? (
              <a className="btn btn-primary" href="/book">
                Request an ambulance
              </a>
            ) : (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setStatusFilter('ALL');
                  setPage(1);
                }}
              >
                Show all bookings
              </button>
            )
          }
        >
          {statusFilter === 'ALL'
            ? 'When you request transport, every booking will appear here with its live status.'
            : `No bookings currently have the status “${statusLabel(statusFilter)}”.`}
        </EmptyState>
      ) : (
        <>
          {data?.items.map((booking) => (
            <BookingCard key={booking.publicId} booking={booking} linkToDetail />
          ))}

          <nav aria-label="Pagination" className="btn-row" style={{ justifyContent: 'center' }}>
            <button
              type="button"
              className="btn btn-secondary btn-small"
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Previous
            </button>
            <span className="muted" aria-live="polite">
              Page {data?.page ?? page} of {totalPages}
            </span>
            <button
              type="button"
              className="btn btn-secondary btn-small"
              disabled={page >= totalPages}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </button>
          </nav>
        </>
      )}
    </>
  );
}

export default function BookingsPage() {
  return (
    <RequireRole>
      <BookingsContent />
    </RequireRole>
  );
}