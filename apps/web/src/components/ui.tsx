import type { ReactNode } from 'react';
import type { BookingStatus, UrgencyCategory } from '@abs/contracts';
import { StatusBadge, UrgencyBadge } from '@/components/status-badge';
import { formatDate, shortId } from '@/lib/format';

/* -------------------------------------------------------------------------- */
/* Card                                                                        */
/* -------------------------------------------------------------------------- */

export function Card({
  children,
  className = '',
  as: Tag = 'section',
}: {
  children: ReactNode;
  className?: string;
  as?: 'section' | 'article' | 'div';
}) {
  return <Tag className={`card ${className}`.trim()}>{children}</Tag>;
}

export function CardHeader({
  title,
  subtitle,
  action,
  level = 2,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  level?: 2 | 3;
}) {
  const Heading = level === 2 ? 'h2' : 'h3';
  return (
    <div className="card__header">
      <div className="spread">
        <div>
          <Heading>{title}</Heading>
          {subtitle ? <p className="muted text-sm">{subtitle}</p> : null}
        </div>
        {action}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Alert                                                                       */
/* -------------------------------------------------------------------------- */

const ALERT_ICON: Record<string, string> = {
  error: 'M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z',
  warning: 'M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z',
  info: 'M12 16v-4m0-4h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
  success: 'm9 12 2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  note: 'M12 8v.01M11 12h1v5h1M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
};

export function Alert({
  tone = 'info',
  title,
  children,
  onDismiss,
}: {
  tone?: 'error' | 'warning' | 'info' | 'success' | 'note';
  title?: ReactNode;
  children?: ReactNode;
  onDismiss?: () => void;
}) {
  const className = tone === 'note' ? 'alert' : `alert alert-${tone}`;
  const live = tone === 'error' ? 'assertive' : 'polite';
  return (
    <div className={className} role={tone === 'error' ? 'alert' : 'note'} aria-live={live}>
      <svg
        className="alert__icon"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d={ALERT_ICON[tone] ?? ALERT_ICON.info} />
      </svg>
      <div className="alert__body">
        {title ? <strong className="alert__title">{title}</strong> : null}
        {children}
      </div>
      {onDismiss ? (
        <button type="button" className="icon-btn" onClick={onDismiss} aria-label="Dismiss">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* States                                                                      */
/* -------------------------------------------------------------------------- */

export function EmptyState({
  icon = 'inbox',
  title,
  children,
  action,
}: {
  icon?: 'inbox' | 'map' | 'shield' | 'ambulance';
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
}) {
  const paths: Record<string, string> = {
    inbox: 'M22 12h-6l-2 3h-4l-2-3H2M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z',
    map: 'M9 20 3 17V4l6 3m0 13 6-3m-6 3V7m6 10 6 3V7l-6-3m0 13V4M3 7l6-3 6 3 6-3',
    shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z',
    ambulance: 'M10 10H6m4 0V6m4 4h.01M4 6h11v10H4V6Zm11 4h4l2 3v3h-6v-6Z',
  };
  return (
    <div className="card empty-state">
      <div className="empty-state__icon">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d={paths[icon] ?? paths.inbox} />
        </svg>
      </div>
      <h3>{title}</h3>
      {children ? <p>{children}</p> : null}
      {action ? <div className="btn-row" style={{ justifyContent: 'center' }}>{action}</div> : null}
    </div>
  );
}

export function SkeletonList({ rows = 3, label }: { rows?: number; label: string }) {
  return (
    <div role="status" aria-label={label}>
      {Array.from({ length: rows }).map((_, index) => (
        <div className="card" key={index} aria-hidden="true">
          <div className="skeleton skeleton--title" />
          <div className="skeleton" />
          <div className="skeleton skeleton--short" />
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Stats                                                                       */
/* -------------------------------------------------------------------------- */

export function StatCard({
  label,
  value,
  tone = 'neutral',
  hint,
}: {
  label: string;
  value: ReactNode;
  tone?: 'neutral' | 'success' | 'warning' | 'muted' | 'critical';
  hint?: string;
}) {
  const toneClass = {
    neutral: '',
    success: 'fleet-available',
    warning: 'fleet-busy',
    muted: 'fleet-off',
    critical: '',
  }[tone];
  return (
    <div className={`stat ${toneClass}`.trim()}>
      <span className="stat__label">{label}</span>
      <span className="stat__value">{value}</span>
      {hint ? <span className="text-xs muted">{hint}</span> : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Route                                                                       */
/* -------------------------------------------------------------------------- */

export function RouteSummary({
  booking,
}: {
  booking: {
    pickup: { label: string; address: string };
    destination: { label: string; address: string };
    destinationPending?: boolean;
  };
}) {
  return (
    <div className="route-summary">
      <div className="route-stop">
        <span className="route-dot" aria-hidden="true" />
        <span>
          <span className="route-label">Pickup</span>
          <br />
          <span className="route-address">{booking.pickup.label} &middot; {booking.pickup.address}</span>
        </span>
      </div>
      <div className="route-stop">
        <span className="route-dot destination" aria-hidden="true" />
        <span>
          <span className="route-label">
            Destination
            {booking.destinationPending ? ' (to be confirmed)' : ''}
          </span>
          <br />
          <span className="route-address">{booking.destination.label}</span>
        </span>
      </div>
    </div>
  );
}

export function BookingMeta({ booking }: { booking: { publicId: string; status: BookingStatus; urgency: UrgencyCategory; requiredAmbulanceType: string; createdAt: string } }) {
  return (
    <>
      <div className="meta-row" style={{ marginTop: 0 }}>
        <span className="pub-id">{shortId(booking.publicId)}</span>
        <StatusBadge status={booking.status} />
        <UrgencyBadge urgency={booking.urgency} />
      </div>
      <div className="meta-row">
        <span>{booking.requiredAmbulanceType}</span>
        <span aria-hidden="true">&middot;</span>
        <span>Requested {formatDate(booking.createdAt)} UTC</span>
      </div>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Section heading                                                             */
/* -------------------------------------------------------------------------- */

export function SectionHeading({
  eyebrow,
  title,
  children,
  align = 'left',
}: {
  eyebrow?: string;
  title: ReactNode;
  children?: ReactNode;
  align?: 'left' | 'center';
}) {
  return (
    <div className={align === 'center' ? 'text-center' : undefined} style={{ maxWidth: align === 'center' ? '46rem' : '40rem', margin: align === 'center' ? '0 auto' : undefined }}>
      {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
      <h2 style={{ fontSize: 'var(--text-3xl)', marginBottom: 'var(--space-3)' }}>{title}</h2>
      {children ? <p className="muted">{children}</p> : null}
    </div>
  );
}