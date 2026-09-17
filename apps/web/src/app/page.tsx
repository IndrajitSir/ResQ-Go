import Link from 'next/link';
import { DisclaimerBanner } from '@/components/disclaimer-banner';

export const metadata = {
  title: 'ABS — Book an ambulance in minutes',
};

const steps = [
  {
    title: 'Describe the trip',
    body: 'Enter pickup and destination, choose the level of care you need, and set the urgency.',
  },
  {
    title: 'We search for ambulances',
    body: 'Dispatch sees your request immediately and matches it to the nearest suitable, available ambulance.',
  },
  {
    title: 'Track your trip',
    body: 'Follow the status live — driver en route, arrived, on board, and in transit — until you reach your destination.',
  },
];

const features = [
  {
    title: 'For dispatchers',
    body: 'A live queue of pending requests with urgency and required care level, plus a filtered list of eligible ambulances for one-click assignment.',
  },
  {
    title: 'For drivers',
    body: 'Set your availability, accept or reject assignments with a reason, and progress trips step by step from en route to completed.',
  },
  {
    title: 'Clear status, always',
    body: 'Every booking shows a full event timeline and a color-coded status so patients, crews, and operators share one source of truth.',
  },
];

export default function LandingPage() {
  return (
    <>
      <section className="hero">
        <h1>Book an ambulance in minutes</h1>
        <p>
          ABS connects patients with the right ambulance — from basic patient transport to
          intensive care units — and keeps everyone informed from request to arrival.
        </p>
        <div className="btn-row" style={{ justifyContent: 'center' }}>
          <Link className="btn btn-primary" href="/register">
            Create an account
          </Link>
          <Link className="btn btn-ghost" href="/book">
            Book an ambulance
          </Link>
        </div>
      </section>

      <DisclaimerBanner />

      <section aria-labelledby="how-it-works">
        <h2 id="how-it-works" className="page-title">
          How it works
        </h2>
        <div className="steps-grid">
          {steps.map((step, index) => (
            <div className="card" key={step.title}>
              <span className="step-number" aria-hidden="true">
                {index + 1}
              </span>
              <h3>{step.title}</h3>
              <p className="muted">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="who-its-for" style={{ marginTop: '2rem' }}>
        <h2 id="who-its-for" className="page-title">
          Built for the whole care chain
        </h2>
        <div className="features-grid">
          {features.map((feature) => (
            <div className="card" key={feature.title}>
              <h3>{feature.title}</h3>
              <p className="muted">{feature.body}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
