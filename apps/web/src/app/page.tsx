import Link from 'next/link';
import { DisclaimerBanner } from '@/components/disclaimer-banner';
import { Reveal } from '@/components/reveal';
import { JourneyDemo } from '@/components/landing/journey';
import { RoleExplorer } from '@/components/landing/roles';

export const metadata = {
  title: 'ResQ-Go — Ambulance booking, dispatch and live tracking',
  description:
    'Request an ambulance in one tap, let dispatch find the nearest suitable crew, and follow the trip live from dispatch to handover. Built for patients, drivers and dispatchers.',
};

/** Invariants the product actually enforces, not aspirations. */
const GUARANTEES = [
  {
    title: 'A vehicle is never double-booked',
    body: 'Assignment claims the ambulance and the booking with conditional updates inside one transaction. When two dispatchers race, exactly one wins and the other gets a clear conflict.',
  },
  {
    title: 'The same request never becomes two bookings',
    body: 'Creation is idempotent. A retried or double-tapped request returns the original booking instead of dispatching a second crew.',
  },
  {
    title: 'Status can only move forward, legally',
    body: 'One state machine in shared code decides every transition. The server rejects anything else, so no client can invent a status.',
  },
  {
    title: 'A booking is visible only to the people involved',
    body: 'Patients see their own trips, drivers see theirs, operators see the queue. Anyone else gets a 404 — not a hint that the booking exists.',
  },
  {
    title: 'Every important action is attributable',
    body: 'Transitions, assignments and cancellations are written to an immutable event log with the actor and a correlation id.',
  },
  {
    title: 'Location is collected for a reason',
    body: 'Coordinates are used to find the nearest crew and share live progress. They are explained before collection and never logged.',
  },
];

export default function LandingPage() {
  return (
    <>
      {/* ---------------------------------------------------------------- */}
      {/* Hero                                                              */}
      {/* ---------------------------------------------------------------- */}
      <section className="hero">
        <div className="hero__grid" aria-hidden="true" />
        <div className="container hero__inner">
          <Reveal>
            <span className="eyebrow">
              <span className="live-dot" style={{ marginLeft: 0 }} />
              Live dispatch · live tracking
            </span>
            <h1 className="hero__title">
              From a tap to an arriving ambulance, without the guesswork.
            </h1>
            <p className="hero__lead">
              ResQ-Go connects a patient to the right crew, keeps dispatch honest about which
              vehicles are free, and shows everyone the same status from request to handover.
            </p>
            <div className="hero__actions">
              <Link className="btn btn-primary btn-lg" href="/book">
                Book an ambulance
              </Link>
              <a className="btn btn-secondary btn-lg" href="#journey">
                See how it works
              </a>
            </div>
            <Link className="hero__emergency" href="/book/emergency">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
              </svg>
              Medical emergency? Request in one tap
            </Link>
          </Reveal>
        </div>
      </section>

      <div className="container">
        <DisclaimerBanner />
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Problem                                                           */}
      {/* ---------------------------------------------------------------- */}
      <section className="section" aria-labelledby="problem-title">
        <div className="container">
          <Reveal>
            <span className="eyebrow">The gap</span>
            <h2 id="problem-title" style={{ fontSize: 'var(--text-3xl)', maxWidth: '38ch' }}>
              Booking an ambulance is not the hard part.
            </h2>
          </Reveal>

          <div className="problem-grid">
            {[
              {
                title: 'Nobody can see the truth',
                body: 'A caller is told an ambulance is coming. The dispatcher sees a name on a list. The driver sees a phone number. Three people, three different pictures of the same trip.',
              },
              {
                title: 'Availability is guesswork',
                body: 'Whether a vehicle is genuinely free is usually a message away. Two dispatchers acting at once can send two crews to one address.',
              },
              {
                title: 'Status is a promise, not a record',
                body: '“On the way” can mean anything. Without a shared, enforced notion of state, patients are asked to trust rather than to know.',
              },
            ].map((item, index) => (
              <Reveal key={item.title} delay={index * 80}>
                <article className="problem-card">
                  <h3>{item.title}</h3>
                  <p className="muted">{item.body}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Interactive journey — the centrepiece                             */}
      {/* ---------------------------------------------------------------- */}
      <section className="section section--alt" id="journey" aria-labelledby="journey-title">
        <div className="container">
          <Reveal>
            <span className="eyebrow">How it works</span>
            <h2 id="journey-title" style={{ fontSize: 'var(--text-3xl)', maxWidth: '34ch' }}>
              One request. A chain of handovers, each one recorded.
            </h2>
            <p className="muted" style={{ maxWidth: '58ch' }}>
              This is the real lifecycle. Step through it to see who acts, what the API is asked to
              do, and what the person on the other end sees.
            </p>
          </Reveal>

          <Reveal delay={80} distance={22}>
            <JourneyDemo />
          </Reveal>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Roles                                                             */}
      {/* ---------------------------------------------------------------- */}
      <section className="section" aria-labelledby="roles-title">
        <div className="container">
          <Reveal>
            <span className="eyebrow">Who uses it</span>
            <h2 id="roles-title" style={{ fontSize: 'var(--text-3xl)', maxWidth: '32ch' }}>
              Three roles, one shared picture.
            </h2>
          </Reveal>

          <Reveal delay={80}>
            <RoleExplorer />
          </Reveal>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Guarantees                                                        */}
      {/* ---------------------------------------------------------------- */}
      <section className="section section--alt" aria-labelledby="guarantees-title">
        <div className="container">
          <Reveal>
            <span className="eyebrow">Under the hood</span>
            <h2 id="guarantees-title" style={{ fontSize: 'var(--text-3xl)', maxWidth: '34ch' }}>
              What the system refuses to get wrong.
            </h2>
            <p className="muted" style={{ maxWidth: '58ch' }}>
              These are enforced server-side, not conventions the UI follows.
            </p>
          </Reveal>

          <div className="guarantee-grid">
            {GUARANTEES.map((item, index) => (
              <Reveal key={item.title} delay={index * 60} distance={14}>
                <article className="guarantee">
                  <svg
                    className="guarantee__icon"
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
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
                    <path d="m9 12 2 2 4-4" />
                  </svg>
                  <h3>{item.title}</h3>
                  <p className="muted">{item.body}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Close                                                             */}
      {/* ---------------------------------------------------------------- */}
      <section className="section closing" aria-labelledby="closing-title">
        <div className="container container-narrow text-center">
          <Reveal>
            <h2 id="closing-title" style={{ fontSize: 'var(--text-3xl)' }}>
              Ready when you are.
            </h2>
            <p className="muted" style={{ maxWidth: '46ch', margin: '0 auto var(--space-5)' }}>
              Create an account to request transport, or sign in to your dispatch or driver
              console.
            </p>
            <div className="row" style={{ justifyContent: 'center' }}>
              <Link className="btn btn-primary btn-lg" href="/register">
                Create an account
              </Link>
              <Link className="btn btn-secondary btn-lg" href="/login">
                Sign in
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}