'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, type FormEvent } from 'react';
import type { BookingView } from '@abs/contracts';
import { RequireRole } from '@/lib/guards';
import { apiFetch, isApiClientError } from '@/lib/api';

const AMBULANCE_TYPES = [
  {
    value: 'BLS',
    label: 'BLS — Basic Life Support',
    description: 'Basic monitoring and oxygen support for stable patients.',
  },
  {
    value: 'ALS',
    label: 'ALS — Advanced Life Support',
    description: 'Advanced equipment and trained crew for serious but not critical conditions.',
  },
  {
    value: 'ICU',
    label: 'ICU — Intensive Care Transport',
    description: 'Fully equipped intensive care unit on wheels for critical patients.',
  },
  {
    value: 'PATIENT_TRANSPORT',
    label: 'Patient Transport (non-emergency)',
    description: 'Planned, non-emergency transport such as hospital transfers or appointments.',
  },
] as const;

const URGENCIES = [
  { value: 'PLANNED', label: 'Planned', hint: 'Scheduled transfer, no time pressure.' },
  { value: 'URGENT', label: 'Urgent', hint: 'Needs an ambulance soon, but not life-threatening.' },
  { value: 'EMERGENCY', label: 'Emergency', hint: 'Serious situation — dispatch ASAP.' },
] as const;

interface PickupState {
  label: string;
  address: string;
  latitude: string;
  longitude: string;
}

function BookingForm() {
  const router = useRouter();
  const idempotencyKeyRef = useRef<string>(crypto.randomUUID());

  const [pickup, setPickup] = useState<PickupState>({ label: '', address: '', latitude: '', longitude: '' });
  const [destination, setDestination] = useState({ label: '', address: '' });
  const [ambulanceType, setAmbulanceType] = useState<string>('BLS');
  const [urgency, setUrgency] = useState<string>('URGENT');
  const [notes, setNotes] = useState('');
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function useMyLocation() {
    setGeoError(null);
    if (!('geolocation' in navigator)) {
      setGeoError('Geolocation is not supported by this browser. Please enter the address manually.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setPickup((prev) => ({
          ...prev,
          latitude: position.coords.latitude.toFixed(6),
          longitude: position.coords.longitude.toFixed(6),
        }));
        setLocating(false);
      },
      () => {
        setGeoError('Could not get your location. You can fill the coordinates in manually.');
        setLocating(false);
      },
      { timeout: 10000 },
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const body = {
        idempotencyKey: idempotencyKeyRef.current,
        pickup: {
          label: pickup.label.trim(),
          address: pickup.address.trim(),
          latitude: Number(pickup.latitude),
          longitude: Number(pickup.longitude),
        },
        destination: {
          label: destination.label.trim(),
          address: destination.address.trim(),
          latitude: Number(pickup.latitude),
          longitude: Number(pickup.longitude),
        },
        requiredAmbulanceType: ambulanceType,
        urgency,
        notes: notes.trim() || undefined,
      };
      const booking = await apiFetch<BookingView>('/bookings', { method: 'POST', body });
      router.push(`/bookings/${booking.publicId}`);
    } catch (err) {
      setError(
        isApiClientError(err)
          ? err.message
          : 'Could not create the booking. Please try again in a moment.',
      );
      setSubmitting(false);
    }
  }

  const latNum = Number(pickup.latitude);
  const lonNum = Number(pickup.longitude);
  const coordinatesValid =
    pickup.latitude !== '' &&
    pickup.longitude !== '' &&
    Number.isFinite(latNum) &&
    Number.isFinite(lonNum) &&
    latNum >= -90 &&
    latNum <= 90 &&
    lonNum >= -180 &&
    lonNum <= 180;

  return (
    <form onSubmit={handleSubmit} noValidate>
      {error && (
        <div className="alert alert-error" role="alert" aria-live="assertive">
          {error}
        </div>
      )}

      <section className="card" aria-labelledby="pickup-heading">
        <h2 id="pickup-heading">Pickup location</h2>
        <p className="hint">
          Your coordinates are used only to find nearby ambulances. They are sent with this
          booking request and are not shared for any other purpose.
        </p>
        <div className="btn-row" style={{ marginTop: 0, marginBottom: '1rem' }}>
          <button
            type="button"
            className="btn btn-ghost btn-small"
            onClick={useMyLocation}
            disabled={locating}
          >
            {locating ? 'Locating…' : 'Use my current location'}
          </button>
        </div>
        {geoError && (
          <p className="field-error" role="alert">
            {geoError}
          </p>
        )}
        <label className="field">
          <span>Location label</span>
          <input
            type="text"
            value={pickup.label}
            onChange={(e) => setPickup((p) => ({ ...p, label: e.target.value }))}
            placeholder="e.g. Home, Office, Main gate"
            required
            minLength={3}
          />
        </label>
        <label className="field">
          <span>Street address</span>
          <input
            type="text"
            value={pickup.address}
            onChange={(e) => setPickup((p) => ({ ...p, address: e.target.value }))}
            placeholder="Full street address"
            required
            minLength={5}
          />
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <label className="field">
            <span>Latitude</span>
            <input
              type="number"
              step="any"
              min={-90}
              max={90}
              value={pickup.latitude}
              onChange={(e) => setPickup((p) => ({ ...p, latitude: e.target.value }))}
              required
            />
          </label>
          <label className="field">
            <span>Longitude</span>
            <input
              type="number"
              step="any"
              min={-180}
              max={180}
              value={pickup.longitude}
              onChange={(e) => setPickup((p) => ({ ...p, longitude: e.target.value }))}
              required
            />
          </label>
        </div>
        {!coordinatesValid && (
          <p className="hint">Coordinates are required — use your location or enter them manually.</p>
        )}
      </section>

      <section className="card" aria-labelledby="destination-heading">
        <h2 id="destination-heading">Destination</h2>
        <label className="field">
          <span>Destination label</span>
          <input
            type="text"
            value={destination.label}
            onChange={(e) => setDestination((d) => ({ ...d, label: e.target.value }))}
            placeholder="e.g. City General Hospital"
            required
            minLength={3}
          />
        </label>
        <label className="field">
          <span>Destination address</span>
          <input
            type="text"
            value={destination.address}
            onChange={(e) => setDestination((d) => ({ ...d, address: e.target.value }))}
            placeholder="Hospital or facility address"
            required
            minLength={5}
          />
        </label>
      </section>

      <section className="card" aria-labelledby="care-heading">
        <h2 id="care-heading">Ambulance type</h2>
        <fieldset>
          <legend>Level of care required</legend>
          {AMBULANCE_TYPES.map((type) => (
            <label className="radio-option" key={type.value}>
              <input
                type="radio"
                name="ambulanceType"
                value={type.value}
                checked={ambulanceType === type.value}
                onChange={() => setAmbulanceType(type.value)}
              />
              <span>
                <strong>{type.label}</strong>
                <br />
                <span className="muted">{type.description}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <fieldset>
          <legend>Urgency</legend>
          {URGENCIES.map((option) => (
            <label className="radio-option" key={option.value}>
              <input
                type="radio"
                name="urgency"
                value={option.value}
                checked={urgency === option.value}
                onChange={() => setUrgency(option.value)}
              />
              <span>
                <strong>{option.label}</strong>
                <br />
                <span className="muted">{option.hint}</span>
              </span>
            </label>
          ))}
        </fieldset>
        {urgency === 'EMERGENCY' && (
          <p className="alert alert-warning" role="note" style={{ marginTop: 0 }}>
            If this is a life-threatening emergency, call your local emergency number (e.g. 911 /
            112) first.
          </p>
        )}

        <label className="field">
          <span>Notes for the crew (optional)</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={1000}
            placeholder="Access details, patient condition, contact person…"
          />
        </label>
      </section>

      <button type="submit" className="btn btn-primary" disabled={submitting || !coordinatesValid}>
        {submitting ? 'Requesting ambulance…' : 'Request ambulance'}
      </button>
    </form>
  );
}

export default function BookPage() {
  return (
    <RequireRole role={['PATIENT']}>
      <h1 className="page-title">Book an ambulance</h1>
      <p className="subtitle">Fill in the trip details below. Dispatch will be notified immediately.</p>
      <BookingForm />
    </RequireRole>
  );
}
