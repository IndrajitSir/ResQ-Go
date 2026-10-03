'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { canTransition, type BookingStatus } from '@abs/contracts';
import { StatusBadge } from '@/components/status-badge';
import { statusLabel } from '@/lib/format';
import { usePrefersReducedMotion } from '@/components/use-reduced-motion';

/**
 * The canonical happy path through the booking lifecycle.
 *
 * Every hop below is asserted against the shared state machine at module load,
 * so this demo cannot drift away from what the API actually allows. If the
 * contracts change and a hop becomes invalid, the demo fails loudly in
 * development instead of quietly teaching an impossible workflow.
 */
const JOURNEY: readonly {
  status: BookingStatus;
  actor: 'Patient' | 'Dispatch' | 'Crew';
  action: string;
  detail: string;
  endpoint: string;
  /** Marker position on the schematic map. */
  at: [number, number];
}[] = [
  {
    status: 'REQUESTED',
    actor: 'Patient',
    action: 'One tap sends your location',
    detail:
      'An emergency request goes out with coordinates only. Dispatch sees it immediately, while you are still on the line.',
    endpoint: 'POST /bookings',
    at: [10, 52],
  },
  {
    status: 'SEARCHING',
    actor: 'Dispatch',
    action: 'The nearest suitable crew is found',
    detail:
      'Only available vehicles of the required type are offered, ranked by straight-line distance from the pickup.',
    endpoint: 'GET /dispatch/eligible',
    at: [10, 52],
  },
  {
    status: 'ASSIGNED',
    actor: 'Dispatch',
    action: 'A crew is claimed, atomically',
    detail:
      'The vehicle is locked in a single conditional update, so two dispatchers racing for the same ambulance cannot both win.',
    endpoint: 'POST /dispatch/bookings/:id/assign',
    at: [10, 52],
  },
  {
    status: 'DRIVER_EN_ROUTE',
    actor: 'Crew',
    action: 'The crew accepts and sets off',
    detail:
      'Declining is a valid answer: the request returns to the queue and another crew is offered the trip.',
    endpoint: 'POST /trips/:id/decision',
    at: [34, 44],
  },
  {
    status: 'ARRIVED',
    actor: 'Crew',
    action: 'Arrival is confirmed on scene',
    detail: 'The requester sees the crew name and a direct call button as soon as a crew is attached.',
    endpoint: 'POST /trips/:id/status',
    at: [45, 36],
  },
  {
    status: 'PATIENT_ONBOARD',
    actor: 'Crew',
    action: 'Patient is on board',
    detail: 'Receiving-facility confirmation can happen in parallel; the trip does not wait for it.',
    endpoint: 'POST /trips/:id/status',
    at: [45, 36],
  },
  {
    status: 'IN_TRANSIT',
    actor: 'Crew',
    action: 'En route to the facility',
    detail:
      'Position pings update the requester’s ETA live over server-sent events — no page refresh needed.',
    endpoint: 'POST /trips/:id/location',
    at: [64, 25],
  },
  {
    status: 'COMPLETED',
    actor: 'Crew',
    action: 'Handover, then release the vehicle',
    detail:
      'Every transition above is written to an immutable event log with who did it and when.',
    endpoint: 'POST /trips/:id/status',
    at: [88, 13],
  },
] as const;

// Guard the demo against contract drift at import time (development only).
if (process.env.NODE_ENV !== 'production') {
  for (let index = 1; index < JOURNEY.length; index += 1) {
    const from = JOURNEY[index - 1]!.status;
    const to = JOURNEY[index]!.status;
    if (!canTransition(from, to)) {
      throw new Error(
        `ResQ-Go journey demo is out of sync with the booking state machine: ${from} -> ${to} is not a legal transition.`,
      );
    }
  }
}

const AUTO_PLAY_MS = 2600;

const ACTOR_TONE: Record<string, string> = {
  Patient: 'badge-active',
  Dispatch: 'badge-info',
  Crew: 'badge-neutral',
};

/** SVG positions for the schematic: station, pickup, and facility. */
const BASE = [10, 52] as const;
const PICKUP = [45, 36] as const;
const FACILITY = [88, 13] as const;

export function JourneyDemo() {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const reducedMotion = usePrefersReducedMotion();
  const timelineRef = useRef<HTMLOListElement | null>(null);

  const step = JOURNEY[index]!;

  const goTo = useCallback((next: number) => {
    setIndex(Math.max(0, Math.min(JOURNEY.length - 1, next)));
  }, []);

  // Auto-advance, unless the viewer asked for reduced motion or paused.
  useEffect(() => {
    if (!playing || reducedMotion) return;
    if (index >= JOURNEY.length - 1) {
      setPlaying(false);
      return;
    }
    const timer = window.setTimeout(() => setIndex((current) => current + 1), AUTO_PLAY_MS);
    return () => window.clearTimeout(timer);
  }, [playing, reducedMotion, index]);

  // Keep the focused step visible when driving the rail from the keyboard.
  // This adjusts the rail's own horizontal offset only: `scrollIntoView`
  // would also scroll the page, yanking the visitor away from whatever they
  // were actually reading whenever the demo auto-advances.
  useEffect(() => {
    const rail = timelineRef.current;
    if (!rail) return;
    const active = rail.querySelector<HTMLElement>('[data-active="true"]');
    if (!active) return;

    const railBox = rail.getBoundingClientRect();
    const activeBox = active.getBoundingClientRect();
    if (activeBox.left >= railBox.left && activeBox.right <= railBox.right) return;

    rail.scrollTo({
      left: active.offsetLeft - rail.clientWidth / 2 + active.clientWidth / 2,
      behavior: reducedMotion ? 'auto' : 'smooth',
    });
  }, [index, reducedMotion]);

  const progress = useMemo(() => (index / (JOURNEY.length - 1)) * 100, [index]);

  const atEnd = index === JOURNEY.length - 1;

  return (
    <div className="journey">
      <div className="journey__stage">
        <JourneyMap position={step.at} arrived={atEnd} />

        <div className="journey__readout">
          <div className="row" style={{ gap: 'var(--space-2)' }}>
            <span className={`badge ${ACTOR_TONE[step.actor]}`}>{step.actor}</span>
            <StatusBadge status={step.status} />
            <span className="text-xs muted mono">{step.endpoint}</span>
          </div>
          <h3 style={{ margin: 'var(--space-3) 0 var(--space-2)', fontSize: 'var(--text-xl)' }}>
            {step.action}
          </h3>
          <p className="muted" style={{ margin: 0 }}>
            {step.detail}
          </p>
        </div>
      </div>

      <div className="journey__controls">
        <div className="journey__progress" aria-hidden="true">
          <span style={{ width: `${progress}%` }} />
        </div>

        <ol className="journey__rail" ref={timelineRef} aria-label="Booking lifecycle steps">
          {JOURNEY.map((entry, entryIndex) => {
            const state =
              entryIndex < index ? 'done' : entryIndex === index ? 'active' : 'upcoming';
            return (
              <li key={entry.status} data-state={state} data-active={entryIndex === index}>
                <button
                  type="button"
                  onClick={() => {
                    goTo(entryIndex);
                    setPlaying(false);
                  }}
                  aria-current={entryIndex === index ? 'step' : undefined}
                >
                  <span className="journey__dot" aria-hidden="true" />
                  <span className="journey__dot-label">{statusLabel(entry.status)}</span>
                </button>
              </li>
            );
          })}
        </ol>

        <div className="journey__actions">
          <button
            type="button"
            className="btn btn-secondary btn-small"
            onClick={() => {
              setPlaying(false);
              goTo(index - 1);
            }}
            disabled={index === 0}
          >
            Previous
          </button>

          <button
            type="button"
            className="btn btn-ghost btn-small"
            onClick={() => {
              if (atEnd) {
                goTo(0);
                setPlaying(!playing);
              } else {
                goTo(index + 1);
              }
            }}
          >
            {atEnd ? (playing ? 'Pause' : 'Replay') : 'Next step'}
          </button>

          {!reducedMotion && !atEnd ? (
            <button
              type="button"
              className="btn btn-ghost btn-small"
              onClick={() => setPlaying((prev) => !prev)}
            >
              {playing ? 'Pause' : 'Play'}
            </button>
          ) : null}
        </div>

        <p className="journey__disclaimer">
          <strong>Interactive preview.</strong> This sequence is simulated in your browser. It
          follows the same state machine the API enforces, but no booking, crew, or notification is
          created here.
        </p>
      </div>
    </div>
  );
}

/**
 * Schematic of the journey rather than a real map: the point is the sequence of
 * handoffs, not turn-by-turn geography. Using a diagram keeps the storytelling
 * honest and avoids implying live tracking that is not happening.
 */
function JourneyMap({ position, arrived }: { position: readonly [number, number]; arrived: boolean }) {
  return (
    <div className="journey__map" role="img" aria-label="Schematic of the ambulance moving from station to pickup to hospital">
      <svg viewBox="0 0 100 64" className="journey__svg" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="journey-route" x1="0" y1="64" x2="100" y2="0">
            <stop offset="0" stopColor="var(--brand-400)" />
            <stop offset="1" stopColor="var(--signal-critical)" />
          </linearGradient>
        </defs>

        {/* Route: station -> pickup -> facility */}
        <path
          d={`M ${BASE[0]} ${BASE[1]} L ${PICKUP[0]} ${PICKUP[1]} L ${FACILITY[0]} ${FACILITY[1]}`}
          fill="none"
          stroke="url(#journey-route)"
          strokeWidth="1.4"
          strokeDasharray="3 2.5"
          strokeLinecap="round"
          opacity="0.75"
        />

        {/* Station */}
        <g>
          <rect
            x={BASE[0] - 4.5}
            y={BASE[1] - 5}
            width="9"
            height="9"
            rx="2"
            fill="var(--surface-inset)"
            stroke="var(--border-default)"
            strokeWidth="0.7"
          />
          <text x={BASE[0]} y={BASE[1] + 9} className="journey__map-label" textAnchor="middle">
            Station
          </text>
        </g>

        {/* Pickup */}
        <g>
          <circle
            cx={PICKUP[0]}
            cy={PICKUP[1]}
            r="3.4"
            fill="var(--accent-soft)"
            stroke="var(--accent)"
            strokeWidth="1.1"
          />
          <text x={PICKUP[0]} y={PICKUP[1] + 9.5} className="journey__map-label" textAnchor="middle">
            Pickup
          </text>
        </g>

        {/* Receiving facility */}
        <g>
          <rect
            x={FACILITY[0] - 4.5}
            y={FACILITY[1] - 4.5}
            width="9"
            height="9"
            rx="1.6"
            fill="var(--signal-critical-bg)"
            stroke="var(--signal-critical)"
            strokeWidth="1.1"
          />
          <path
            d={`M ${FACILITY[0]} ${FACILITY[1] - 2.6} v 5.2 M ${FACILITY[0] - 2.6} ${FACILITY[1] - 0.6} h 5.2`}
            stroke="var(--signal-critical)"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
          <text x={FACILITY[0]} y={FACILITY[1] + 10} className="journey__map-label" textAnchor="middle">
            Hospital
          </text>
        </g>

        {/* Moving ambulance */}
        <g
          className="journey__vehicle"
          style={{ transform: `translate(${position[0]}px, ${position[1]}px)` }}
        >
          <circle
            r={arrived ? 7 : 5.4}
            fill="var(--signal-critical)"
            opacity="0.16"
            className="journey__vehicle-halo"
          />
          <rect x="-4" y="-3" width="8" height="6" rx="1.6" fill="var(--signal-critical)" />
          <path
            d="M-1.6 -0.2 h3.2 M0 -1.8 v3.6"
            stroke="#fff"
            strokeWidth="0.9"
            strokeLinecap="round"
          />
        </g>
      </svg>
    </div>
  );
}