'use client';

import { useCallback, useEffect, useState } from 'react';
import type { NotificationView } from '@abs/contracts';
import { RequireRole } from '@/lib/guards';
import { apiFetch, isApiClientError } from '@/lib/api';
import { Alert, EmptyState, SkeletonList } from '@/components/ui';
import { formatDate } from '@/lib/format';

function NotificationsContent() {
  const [notifications, setNotifications] = useState<NotificationView[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const items = await apiFetch<NotificationView[]>('/notifications/mine');
      setNotifications(items);
      setError(null);
    } catch (err) {
      setError(
        isApiClientError(err)
          ? err.message
          : 'Could not load your notifications. Please try refreshing.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Poll every 15s while the tab is visible.
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        void load(true);
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [load]);

  return (
    <>
      <h1 className="page-title">Notifications</h1>

      {loading && !notifications ? (
        <SkeletonList rows={2} label="Loading notifications" />
      ) : error && !notifications ? (
        <EmptyState
          icon="inbox"
          title="Notifications unavailable"
          action={
            <button type="button" className="btn btn-secondary" onClick={() => void load()}>
              Try again
            </button>
          }
        >
          {error}
        </EmptyState>
      ) : !notifications || notifications.length === 0 ? (
        <EmptyState icon="inbox" title="No notifications yet">
          Updates about your bookings and trips — assignments, arrivals and cancellations — appear
          here.
        </EmptyState>
      ) : error ? (
        <Alert tone="error">{error}</Alert>
      ) : (
        notifications.map((notification) => (
          <article className="card" key={notification.publicId}>
            <p style={{ margin: 0 }}>{notification.body}</p>
            <div className="meta-row">
              <span>{formatDate(notification.createdAt)} UTC</span>
              <span aria-hidden="true">·</span>
              <span className="muted">{notification.channel.replace('_', ' ').toLowerCase()}</span>
            </div>
          </article>
        ))
      )}
    </>
  );
}

export default function NotificationsPage() {
  return (
    <RequireRole>
      <NotificationsContent />
    </RequireRole>
  );
}
