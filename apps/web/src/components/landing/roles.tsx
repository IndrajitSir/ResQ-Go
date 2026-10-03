'use client';

import Link from 'next/link';
import { useState } from 'react';

interface RoleStory {
  id: 'patient' | 'driver' | 'dispatcher';
  label: string;
  headline: string;
  body: string;
  capabilities: string[];
  /** A representative screen, described concretely rather than vaguely. */
  screen: { title: string; rows: Array<{ label: string; value: string; tone?: string }> };
  href: string;
  cta: string;
}

const ROLES: RoleStory[] = [
  {
    id: 'patient',
    label: 'Patient',
    headline: 'One tap when it cannot wait',
    body:
      'An emergency request needs only your location. Everything else — the receiving facility, the crew, the route — is handled by dispatch while you are still on the line.',
    capabilities: [
      'One-tap emergency request with automatic location capture',
      'Live status, ETA and crew contact while the trip is active',
      'Full event history, so you always know what happened and when',
      'Cancellation with a reason, up to the point a crew is committed',
    ],
    screen: {
      title: 'Booking detail',
      rows: [
        { label: 'Status', value: 'Driver en route', tone: 'badge-active' },
        { label: 'Crew', value: 'Ravi Menon · KA-05-AB-1234' },
        { label: 'ETA', value: '6 min · 3.2 km away' },
        { label: 'Destination', value: 'City General Hospital' },
      ],
    },
    href: '/book',
    cta: 'Start a booking',
  },
  {
    id: 'driver',
    label: 'Driver',
    headline: 'A crew workflow that fits in a cab',
    body:
      'Accept or decline with a reason, advance the trip step by step, and share position while the trip is active. Declining is a first-class answer, not a failure.',
    capabilities: [
      'Accept or decline an assignment, with a recorded reason',
      'Advance the trip: en route, arrived, on board, in transit, complete',
      'Share position while the trip is active — rejected once it ends',
      'Set availability to control which assignments reach you',
    ],
    screen: {
      title: 'Driver dashboard',
      rows: [
        { label: 'Assignment', value: 'KA-05-AB-1234 · City General' },
        { label: 'Status', value: 'En route', tone: 'badge-active' },
        { label: 'Next action', value: 'Mark arrival' },
        { label: 'Availability', value: 'On trip' },
      ],
    },
    href: '/driver',
    cta: 'See the driver view',
  },
  {
    id: 'dispatcher',
    label: 'Dispatcher',
    headline: 'The queue, ranked and honest',
    body:
      'Emergencies first, then urgency, then age. Eligible vehicles are filtered by type and ranked by distance, and assignment is locked atomically so nobody is sent twice.',
    capabilities: [
      'Live queue ordered by urgency and waiting time',
      'Eligible vehicles filtered by required type, nearest first',
      'Assignment protected against two dispatchers racing for one ambulance',
      'Active trips on a live map with the latest crew position',
    ],
    screen: {
      title: 'Dispatch console',
      rows: [
        { label: 'Fleet', value: '6 available · 2 on trip' },
        { label: 'Top of queue', value: 'EMERGENCY · 2 min ago' },
        { label: 'Nearest crew', value: 'KA-05-AB-1234 · 3.2 km' },
        { label: 'Action', value: 'Assign' },
      ],
    },
    href: '/dispatcher',
    cta: 'See the dispatch view',
  },
];

/**
 * Role explorer.
 *
 * Each panel describes what that role genuinely does in this product, using the
 * same concepts the API enforces. It is documentation, not a demo: visiting the
 * routes still requires signing in.
 */
export function RoleExplorer() {
  const [activeId, setActiveId] = useState<RoleStory['id']>('patient');
  const active = ROLES.find((role) => role.id === activeId) ?? ROLES[0]!;

  return (
    <div className="roles">
      <div className="roles__tabs" role="tablist" aria-label="Choose a role">
        {ROLES.map((role) => (
          <button
            key={role.id}
            type="button"
            role="tab"
            id={`role-tab-${role.id}`}
            aria-selected={role.id === active.id}
            aria-controls={`role-panel-${role.id}`}
            className="roles__tab"
            onClick={() => setActiveId(role.id)}
          >
            {role.label}
          </button>
        ))}
      </div>

      <div
        className="roles__panel"
        role="tabpanel"
        id={`role-panel-${active.id}`}
        aria-labelledby={`role-tab-${active.id}`}
        tabIndex={0}
      >
        <div className="roles__copy">
          <h3 style={{ fontSize: 'var(--text-xl)', marginBottom: 'var(--space-2)' }}>
            {active.headline}
          </h3>
          <p className="muted">{active.body}</p>
          <ul className="roles__list">
            {active.capabilities.map((capability) => (
              <li key={capability}>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="m5 13 4 4L19 7" />
                </svg>
                <span>{capability}</span>
              </li>
            ))}
          </ul>
          <Link className="btn btn-secondary btn-small" href={active.href}>
            {active.cta}
          </Link>
        </div>

        <div className="roles__preview">
          <div className="roles__preview-bar">
            <span className="roles__preview-dot" aria-hidden="true" />
            <span className="roles__preview-dot" aria-hidden="true" />
            <span className="roles__preview-dot" aria-hidden="true" />
            <span className="roles__preview-title">{active.screen.title}</span>
          </div>
          <dl className="roles__preview-body">
            {active.screen.rows.map((row) => (
              <div className="roles__preview-row" key={row.label}>
                <dt>{row.label}</dt>
                <dd>
                  {row.tone ? <span className={`badge ${row.tone}`}>{row.value}</span> : row.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  );
}