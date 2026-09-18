'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeEvent } from '@abs/contracts';
import { getAccessToken, API_BASE } from '@/lib/api';

/**
 * Subscribes to the server-sent event stream and returns events in reverse
 * chronological order (newest first). Automatically reconnects on drop.
 *
 * @param filterBookingId  When set, only events with a matching bookingPublicId
 *                         are forwarded to the consumer.
 */
export function useRealtime(filterBookingId?: string) {
  const [events, setEvents] = useState<RealtimeEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const esRef = useRef<EventSource | null>(null);
  const filterRef = useRef(filterBookingId);
  filterRef.current = filterBookingId;

  const connect = useCallback(() => {
    const token = getAccessToken();
    if (!token || typeof window === 'undefined') return;

    // Tear down any previous connection.
    esRef.current?.close();

    const url = new URL(`${API_BASE}/realtime/stream`);
    url.searchParams.set('token', token);
    const es = new EventSource(url.toString());
    esRef.current = es;

    es.addEventListener('ping', () => {
      /* keep-alive, ignore */
    });

    // All other events go through a generic "message" listener.
    es.onmessage = (msg) => {
      try {
        const event = JSON.parse(msg.data) as RealtimeEvent;
        const fId = filterRef.current;
        if (fId && event.bookingPublicId !== fId) return;
        setEvents((prev) => [event, ...prev].slice(0, 100)); // keep last 100
      } catch {
        // malformed data — ignore
      }
    };

    es.onerror = () => {
      setConnected(false);
      es.close();
      // Reconnect after a short backoff.
      setTimeout(connect, 3000);
    };

    es.onopen = () => setConnected(true);
  }, []);

  useEffect(() => {
    connect();
    return () => {
      esRef.current?.close();
    };
  }, [connect]);

  return { events, connected };
}
