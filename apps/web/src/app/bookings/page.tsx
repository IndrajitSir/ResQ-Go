'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { BookingStatus, Paginated } from '@abs/contracts';
import { BOOKING_STATUSES } from '@abs/contracts';
import { BookingCard } from '@/components/booking-card';
import { RequireRole } from '@/lib/guards';
import { apiFetch, isApiClientError } from '@/lib/api';
import { statusLabel } from '@/lib/format';

type ListPayload = { items: import('@abs/contracts').BookingView[]; page: number; pageSize: number; total: number; totalPages: number };

function BookingsContent() {
  const [statusFilter, setStatusFilter] = useState<BookingStatus | 'ALL'>('ALL');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ListPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const firstLoad = useRef(true);

  const load = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      if (!opts.silent) setLoading(true);
      else setRefreshing(true);
      try {
        const params = new URLSearchParams();
        if (statusFilter !== 'ALL') params.set('status', statusFilter);
        params.set('page', String(page));
        params.set('pageSize', '10');
        const payload = await apiFetch<Paginated<import('@abs/contracts').BookingView>>(
          `/bookings?${params.toString()}`,
        );
        setData(payload);
        setError(null);
      } catch (err) {
        setError(
          isApiClientError(err)
            ? err.message
            : 'Could not load bookings. Please try refreshing.',
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
        firstLoad.current = false;
      }
    },
    [statusFilter, page],
  );

  useEffect(() => {
    void load();
  }, [load]);

  // Poll every 10s while the tab is visible.
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        void load({ silent: true });
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [load]);

  const totalPages = data?.totalPages ?? 1;

  return (
    <>
      <h1 className="page-title">Bookings</h1>

      <div className="chip-row" role="group" aria-label="Filter by status">
        <button
          type="button"
          className="chip"
          aria-pressed={statusFilter === 'ALL'}
          onClick={() => {
            setStatusFilter('ALL');
            setPage(1);
          }}
        >
          All
        </button>
        {BOOKING_STATUSES.map((status) => (
          <button
            key={status}
            type="button"
            className="chip"
            aria-pressed={statusFilter === status}
            onClick={() => {
              setStatusFilter(status);
              setPage(1);
            }}
          >
            {statusLabel(status)}
          </button>
        ))}
      </div>

      <p className="muted" aria-live="polite" style={{ minHeight: '1.2em' }}>
        {refreshing ? 'Refreshing…' : ''}
      </p>

      {loading && firstLoad.current ? (
        <div role="status" aria-label="Loading bookings">
          <div className="card">
            <div className="skeleton" style={{ width: '40%' }} />
            <div className="skeleton" />
            <div className="skeleton" style={{ width: '70%' }} />
          </div>
          <div className="card">
            <div className="skeleton" style={{ width: '40%' }} />
            <div className="skeleton" />
            <div className="skeleton" style={{ width: '70%' }} />
          </div>
        </div>
      ) : error ? (
        <div className="alert alert-error" role="alert" aria-live="assertive">
          {error}
          <div className="btn-row">
            <button type="button" className="btn btn-ghost btn-small" onClick={() => void load()}>
              Try again
            </button>
          </div>
        </div>
      ) : !data || data.items.length === 0 ? (
        <div className="card empty-state">
          <h2>No bookings found</h2>
          <p>
            {statusFilter !== 'ALL'
              ? `You have no bookings with status "${statusLabel(statusFilter)}". Try clearing the filter.`
              : 'Bookings you request will appear here. Create your first booking from the Book page.'}
          </p>
        </div>
      ) : (
        <>
          {data.items.map((booking) => (
            <BookingCard key={booking.publicId} booking={booking} linkToDetail />
          ))}
          <nav aria-label="Pagination" className="btn-row" style={{ justifyContent: 'center' }}>
            <button
              type="button"
              className="btn btn-ghost btn-small"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </button>
            <span className="muted" aria-live="polite">
              Page {data.page} of {totalPages} · {data.total} total
            </span>
            <button
              type="button"
              className="btn btn-ghost btn-small"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
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
