'use client';

import { useEffect, useState } from 'react';
import { Alert } from '@/components/ui';

const SESSION_KEY = 'resqgo.disclaimer.dismissed';

/**
 * Prominent emergency disclaimer.
 *
 * This is the one message the product must never let a visitor miss, so it is
 * unmissable by design: it is never auto-dismissed, it returns on every new
 * visit, and it stays dismissible only for the current browser session.
 */
export function DisclaimerBanner() {
  const [dismissed, setDismissed] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      setDismissed(window.sessionStorage.getItem(SESSION_KEY) === '1');
    } catch {
      setDismissed(false);
    }
    setMounted(true);
  }, []);

  // Start hidden until we know whether this session dismissed it, so the
  // banner never flashes for someone who already acknowledged it.
  if (!mounted || dismissed) return null;

  return (
    <div style={{ marginBottom: 'var(--space-5)' }}>
      <Alert tone="warning" title="This is not an emergency call service.">
        <p>
          ResQ-Go books and coordinates ambulance transport. In a life-threatening situation, call
          your local emergency number — 911 or 112 — immediately. Do not wait for a request made
          here to be processed.
        </p>
        <div className="btn-row btn-row--tight">
          <button
            type="button"
            className="btn btn-secondary btn-small"
            onClick={() => {
              try {
                window.sessionStorage.setItem(SESSION_KEY, '1');
              } catch {
                // Storage unavailable: the banner simply reappears on reload.
              }
              setDismissed(true);
            }}
          >
            Dismiss for this session
          </button>
        </div>
      </Alert>
    </div>
  );
}