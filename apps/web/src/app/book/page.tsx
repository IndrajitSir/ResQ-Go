'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, type FormEvent } from 'react';
import type { AmbulanceType, BookingView, UrgencyCategory } from '@abs/contracts';
import { RequireRole } from '@/lib/guards';
import { apiFetch, isApiClientError } from '@/lib/api';
import { Alert, Card, RouteSummary } from '@/components/ui';

const AMBULANCE_TYPES: Array<{
  value: AmbulanceType;
  label: string;
  description: string;
}> = [
  {
    value: 'BLS',
    label: 'BLS — Basic Life Support',
    description: 'Basic monitoring and oxygen support for a stable patient.',
  },
  {
    value: 'ALS',
    label: 'ALS — Advanced Life Support',
    description: 'Advanced equipment and a trained crew for serious conditions.',
  },
  {
    value: 'ICU',
    label: 'ICU — Intensive Care Transport',
    description: 'A fully equipped intensive care unit on wheels.',
  },
  {
    value: 'PATIENT_TRANSPORT',
    label: 'Patient transport (non-emergency)',
    description: 'Planned transfers such as hospital discharges or appointments.',
  },
];

const URGENCIES: Array<{ value: UrgencyCategory; label: string; hint: string }> = [
  { value: 'PLANNED', label: 'Planned', hint: 'Scheduled transfer, no time pressure.' },
  { value: 'URGENT', label: 'Urgent', hint: 'Needed soon, but not life-threatening.' },
  { value: 'EMERGENCY', label: 'Emergency', hint: 'Serious situation — dispatch immediately.' },
];

interface Coords {
  latitude: string;
  longitude: string;
}

const EMPTY_COORDS: Coords = { latitude: '', longitude: '' };

/** Validates a decimal-degree pair before it is sent to the API. */
function parseCoords(coords: Coords): { lat: number; lon: number } | null {
  if (coords.latitude === '' || coords.longitude === '') return null;
  const lat = Number(coords.latitude);
  const lon = Number(coords.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { lat, lon };
}

function BookingForm() {
  const router = useRouter();
  // Stable for the lifetime of the form: a retry after a failed submit must
  // reuse the same key so the API can dedupe instead of creating a duplicate.
  const idempotencyKeyRef = useRef<string>(crypto.randomUUID());

  const [pickupLabel, setPickupLabel] = useState('');
  const [pickupAddress, setPickupAddress] = useState('');
  const [pickupCoords, setPickupCoords] = useState<Coords>(EMPTY_COORDS);

  const [destinationLabel, setDestinationLabel] = useState('');
  const [destinationAddress, setDestinationAddress] = useState('');
  const [destinationCoords, setDestinationCoords] = useState<Coords>(EMPTY_COORDS);
  /**
   * Destination coordinates are independent of the pickup. They start empty and
   * only mirror the pickup once the user explicitly chooses to, so a trip can
   * never silently be booked with a zero-length route.
   */
  const [mirrorPickup, setMirrorPickup] = useState(true);

  const [ambulanceType, setAmbulanceType] = useState<AmbulanceType>('BLS');
  const [urgency, setUrgency] = useState<UrgencyCategory>('URGENT');
  const [notes, setNotes] = useState('');

  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  function useMyLocation() {
    setGeoError(null);
    if (!('geolocation' in navigator)) {
      setGeoError('This browser cannot share your location. Enter the coordinates manually.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setPickupCoords({
          latitude: position.coords.latitude.toFixed(6),
          longitude: position.coords.longitude.toFixed(6),
        });
        setLocating(false);
      },
      () => {
        setGeoError('We could not get your location. Enter the coordinates manually below.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
  }

  function validate(): boolean {
    const errors: Record<string, string> = {};

    if (pickupLabel.trim().length < 3) errors.pickupLabel = 'Name the pickup point (at least 3 characters).';
    if (pickupAddress.trim().length < 5) errors.pickupAddress = 'Enter the full pickup address.';
    if (!parseCoords(pickupCoords)) errors.pickupCoords = 'Enter valid latitude and longitude.';

    if (destinationLabel.trim().length < 3) errors.destinationLabel = 'Name the destination.';
    if (destinationAddress.trim().length < 5) errors.destinationAddress = 'Enter the destination address.';
    if (!mirrorPickup && !parseCoords(destinationCoords)) {
      errors.destinationCoords = 'Enter the destination coordinates.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!validate()) {
      // Move focus to the first problem so keyboard and screen-reader users
      // are not left guessing at the top of a long form.
      const firstInvalid = document.querySelector<HTMLElement>('[aria-invalid="true"]');
      firstInvalid?.focus();
      return;
    }

    const pickup = parseCoords(pickupCoords)!;
    const destination = mirrorPickup ? pickup : parseCoords(destinationCoords)!;

    setSubmitting(true);
    try {
      const booking = await apiFetch<BookingView>('/bookings', {
        method: 'POST',
        body: {
          idempotencyKey: idempotencyKeyRef.current,
          pickup: {
            label: pickupLabel.trim(),
            address: pickupAddress.trim(),
            latitude: pickup.lat,
            longitude: pickup.lon,
          },
          destination: {
            label: destinationLabel.trim(),
            address: destinationAddress.trim(),
            latitude: destination.lat,
            longitude: destination.lon,
          },
          requiredAmbulanceType: ambulanceType,
          urgency,
          notes: notes.trim() || undefined,
        },
      });
      router.push(`/bookings/${booking.publicId}`);
    } catch (err) {
      // Form state is deliberately preserved so nothing typed is lost.
      setError(
        isApiClientError(err)
          ? err.message
          : 'We could not create the booking. Check your connection and try again.',
      );
      setSubmitting(false);
    }
  }

  const mirrorOption = (
    <label className="radio-option">
      <input
        type="radio"
        name="destinationCoordsMode"
        checked={mirrorPickup}
        onChange={() => setMirrorPickup(true)}
      />
      <span>
        <span className="radio-option__title">Same coordinates as pickup</span>
        <br />
        <span className="muted text-sm">
          Only correct if the patient is collected and dropped at the same place — for example a
          round trip from home to a clinic that is the next step.
        </span>
      </span>
    </label>
  );

  const customOption = (
    <label className="radio-option">
      <input
        type="radio"
        name="destinationCoordsMode"
        checked={!mirrorPickup}
        onChange={() => {
          setMirrorPickup(false);
          if (destinationCoords === EMPTY_COORDS) {
            // Prefill with the pickup so the user only has to correct it.
            setDestinationCoords(pickupCoords);
          }
        }}
      />
      <span>
        <span className="radio-option__title">A different location</span>
        <br />
        <span className="muted text-sm">Enter where the ambulance is going.</span>
      </span>
    </label>
  );

  return (
    <form onSubmit={handleSubmit} noValidate>
      {error ? <Alert tone="error" title="Booking not created">{error}</Alert> : null}

      <Card>
        <h2>1. Pickup</h2>
        <p className="hint">
          Your coordinates are used only to find the nearest available ambulance and to show the
          crew where to go. They are sent with this request and not used for anything else.
        </p>

        <div className="btn-row" style={{ marginTop: 0, marginBottom: 'var(--space-4)' }}>
          <button
            type="button"
            className="btn btn-secondary btn-small"
            onClick={useMyLocation}
            disabled={locating}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v3m0 14v3M2 12h3m14 0h3" />
            </svg>
            {locating ? 'Finding your location…' : 'Use my current location'}
          </button>
        </div>

        {geoError ? (
          <Alert tone="warning">{geoError}</Alert>
        ) : null}

        <label className="field">
          <span>Location name</span>
          <input
            type="text"
            value={pickupLabel}
            onChange={(event) => setPickupLabel(event.target.value)}
            placeholder="e.g. Home, Office, Main gate"
            aria-invalid={fieldErrors.pickupLabel ? true : undefined}
            aria-describedby={fieldErrors.pickupLabel ? 'pickup-label-error' : undefined}
            required
            minLength={3}
          />
          {fieldErrors.pickupLabel ? (
            <span className="field-error" id="pickup-label-error">
              {fieldErrors.pickupLabel}
            </span>
          ) : null}
        </label>

        <label className="field">
          <span>Street address</span>
          <input
            type="text"
            value={pickupAddress}
            onChange={(event) => setPickupAddress(event.target.value)}
            placeholder="Full street address"
            aria-invalid={fieldErrors.pickupAddress ? true : undefined}
            aria-describedby={fieldErrors.pickupAddress ? 'pickup-address-error' : undefined}
            required
            minLength={5}
          />
          {fieldErrors.pickupAddress ? (
            <span className="field-error" id="pickup-address-error">
              {fieldErrors.pickupAddress}
            </span>
          ) : null}
        </label>

        <div className="field-grid">
          <label className="field">
            <span>Latitude</span>
            <input
              type="number"
              step="any"
              min={-90}
              max={90}
              inputMode="decimal"
              value={pickupCoords.latitude}
              onChange={(event) =>
                setPickupCoords((prev) => ({ ...prev, latitude: event.target.value }))
              }
              aria-invalid={fieldErrors.pickupCoords ? true : undefined}
              aria-describedby={fieldErrors.pickupCoords ? 'pickup-coords-error' : undefined}
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
              inputMode="decimal"
              value={pickupCoords.longitude}
              onChange={(event) =>
                setPickupCoords((prev) => ({ ...prev, longitude: event.target.value }))
              }
              required
            />
          </label>
        </div>
        {fieldErrors.pickupCoords ? (
          <span className="field-error" id="pickup-coords-error">
            {fieldErrors.pickupCoords}
          </span>
        ) : null}
      </Card>

      <Card>
        <h2>2. Destination</h2>
        <label className="field">
          <span>Destination name</span>
          <input
            type="text"
            value={destinationLabel}
            onChange={(event) => setDestinationLabel(event.target.value)}
            placeholder="e.g. City General Hospital"
            aria-invalid={fieldErrors.destinationLabel ? true : undefined}
            aria-describedby={fieldErrors.destinationLabel ? 'dest-label-error' : undefined}
            required
            minLength={3}
          />
          {fieldErrors.destinationLabel ? (
            <span className="field-error" id="dest-label-error">
              {fieldErrors.destinationLabel}
            </span>
          ) : null}
        </label>

        <label className="field">
          <span>Destination address</span>
          <input
            type="text"
            value={destinationAddress}
            onChange={(event) => setDestinationAddress(event.target.value)}
            placeholder="Hospital or facility address"
            aria-invalid={fieldErrors.destinationAddress ? true : undefined}
            aria-describedby={fieldErrors.destinationAddress ? 'dest-address-error' : undefined}
            required
            minLength={5}
          />
          {fieldErrors.destinationAddress ? (
            <span className="field-error" id="dest-address-error">
              {fieldErrors.destinationAddress}
            </span>
          ) : null}
        </label>

        <fieldset>
          <legend>Where exactly?</legend>
          {mirrorOption}
          {customOption}
        </fieldset>

        {!mirrorPickup ? (
          <div className="field-grid">
            <label className="field">
              <span>Latitude</span>
              <input
                type="number"
                step="any"
                min={-90}
                max={90}
                inputMode="decimal"
                value={destinationCoords.latitude}
                onChange={(event) =>
                  setDestinationCoords((prev) => ({ ...prev, latitude: event.target.value }))
                }
                aria-invalid={fieldErrors.destinationCoords ? true : undefined}
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
                inputMode="decimal"
                value={destinationCoords.longitude}
                onChange={(event) =>
                  setDestinationCoords((prev) => ({ ...prev, longitude: event.target.value }))
                }
                required
              />
            </label>
          </div>
        ) : null}
        {fieldErrors.destinationCoords ? (
          <span className="field-error">{fieldErrors.destinationCoords}</span>
        ) : null}
      </Card>

      <Card>
        <h2>3. Level of care and urgency</h2>

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
                <span className="radio-option__title">{type.label}</span>
                <br />
                <span className="muted text-sm">{type.description}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <fieldset>
          <legend>How urgent is this?</legend>
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
                <span className="radio-option__title">{option.label}</span>
                <br />
                <span className="muted text-sm">{option.hint}</span>
              </span>
            </label>
          ))}
        </fieldset>

        {urgency === 'EMERGENCY' ? (
          <Alert tone="warning" title="Call your emergency number first">
            If this is life-threatening, call your local emergency number (such as 911 or 112)
            now. Do not wait for this request to be processed.
          </Alert>
        ) : null}

        <label className="field">
          <span>Notes for the crew (optional)</span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            maxLength={1000}
            placeholder="Access details, patient condition, who to call on arrival…"
          />
        </label>
      </Card>

      <Card className="panel">
        <h3 style={{ fontSize: 'var(--text-md)' }}>Review</h3>
        <RouteSummary
          booking={{
            pickup: {
              label: pickupLabel.trim() || 'Pickup not set',
              address: pickupAddress.trim() || 'Address not set',
            },
            destination: {
              label: destinationLabel.trim() || 'Destination not set',
              address: destinationAddress.trim() || '',
            },
          }}
        />
        <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={submitting}>
          {submitting ? 'Requesting ambulance…' : 'Request ambulance'}
        </button>
        <p className="hint text-center" style={{ marginTop: 'var(--space-3)', marginBottom: 0 }}>
          Dispatch is notified the moment this request is created.
        </p>
      </Card>
    </form>
  );
}

export default function BookPage() {
  return (
    <RequireRole role={['PATIENT']}>
      <div className="page-header">
        <h1 className="page-title">Book an ambulance</h1>
        <p className="subtitle">
          Tell us where to collect the patient and where they are going. Dispatch is notified the
          moment you submit.
        </p>
      </div>
      <BookingForm />
    </RequireRole>
  );
}