'use client';

import { useEffect, useState } from 'react';

const SESSION_KEY = 'abs.disclaimer.dismissed';

/**
 * Prominent emergency disclaimer. Dismissible once per browser session
 * (sessionStorage), reappears on the next visit.
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

  if (!mounted || dismissed) return null;

  return (
    <section className="alert alert-warning" role="note" aria-label="Emergency disclaimer">
      <strong>This is not an emergency call service.</strong> ABS books and coordinates ambulance
      transport. In a life-threatening situation, call your local emergency number (such as 911
      or 112) immediately — do not wait for a booking to be processed here.
      <div className="btn-row" style={{ marginTop: '0.5rem' }}>
        <button
          type="button"
          className="btn btn-ghost btn-small"
          onClick={() => {
            try {
              window.sessionStorage.setItem(SESSION_KEY, '1');
            } catch {
              // ignore storage failure — banner just reappears on reload
            }
            setDismissed(true);
          }}
        >
          Dismiss for this session
        </button>
      </div>
    </section>
  );
}
