'use client';

import Link from 'next/link';
import { useRef, useEffect, useState, type FormEvent } from 'react';
import type { BookingView } from '@abs/contracts';
import { RequireRole } from '@/lib/guards';
import { apiFetch, isApiClientError } from '@/lib/api';

/**
 * One-tap emergency booking flow.
 *
 * Designed for high-stress situations: a single large action button, automatic
 * location capture, and an immediate fallback to the local emergency number.
 * Emergency requests raise a booking with coordinates only — dispatch confirms
 * the receiving facility while a crew is already moving (RULES.md).
 */
export default function EmergencyBookingPage() {
  return (
    <RequireRole role={['PATIENT']}>
      <EmergencyForm />
    </RequireRole>
  );
}

interface PickupState {
  latitude: string;
  longitude: string;
  label: string;
  locating: boolean;
  geoError: string | null;
}

function EmergencyForm() {
  const idempotencyKeyRef = useRef(crypto.randomUUID());

  const [pickup, setPickup] = useState<PickupState>({
    latitude: '',
    longitude: '',
    label: '',
    locating: false,
    geoError: null,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<BookingView | null>(null);

  function captureLocation() {
    if (!('geolocation' in navigator)) {
      setPickup((p) => ({
        ...p,
        geoError: 'Geolocation is not supported by this browser. Please call your local emergency number.',
      }));
      return;
    }
    setPickup((p) => ({ ...p, locating: true, geoError: null }));
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPickup((p) => ({
          ...p,
          latitude: pos.coords.latitude.toFixed(6),
          longitude: pos.coords.longitude.toFixed(6),
          label: 'Current device location',
          locating: false,
          geoError: null,
        }));
      },
      () => {
        setPickup((p) => ({
          ...p,
          locating: false,
          geoError:
            'Could not access your location. Your device coordinates may be sent manually, or you can call your local emergency number.',
        }));
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 },
    );
  }

  // Auto-capture on first render so the user only has one tap.
  useEffect(() => {
    captureLocation();
  }, []);

  async function handleEmergency(event: FormEvent) {
    event.preventDefault();
    if (!pickup.latitude || !pickup.longitude) {
      setError('Your location could not be determined. Please call your local emergency number.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const booking = await apiFetch<BookingView>('/bookings', {
        method: 'POST',
        body: {
          idempotencyKey: idempotencyKeyRef.current,
          pickup: {
            label: pickup.label || 'Device location',
            address: `${pickup.latitude}, ${pickup.longitude}`,
            latitude: Number(pickup.latitude),
            longitude: Number(pickup.longitude),
          },
          requiredAmbulanceType: 'BLS',
          urgency: 'EMERGENCY',
        },
        auth: true,
      });
      setConfirmed(booking);
    } catch (err) {
      setError(
        isApiClientError(err) ? err.message : 'Could not reach dispatch. Please call your local emergency number.',
      );
      setSubmitting(false);
    }
  }

  if (confirmed) {
    return (
      <>
        <div className="card emergency-confirmed">
          <div className="emergency-icon" aria-hidden="true">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
            </svg>
          </div>
          <h1 className="emergency-title">Ambulance requested</h1>
          <p className="emergency-sub">
            Dispatch has your location and is finding the nearest available crew.
            Your receiving facility is being confirmed.
          </p>

          <div className="emergency-booking-id">
            Reference <code>{confirmed.publicId}</code>
          </div>

          <dl className="emergency-meta">
            <div>
              <dt>Status</dt>
              <dd>{confirmed.status}</dd>
            </div>
            <div>
              <dt>Ambulance type</dt>
              <dd>{confirmed.requiredAmbulanceType}</dd>
            </div>
            <div>
              <dt>Pickup</dt>
              <dd>{confirmed.pickup.label}</dd>
            </div>
            <div>
              <dt>Destination</dt>
              <dd>{confirmed.destination?.label ?? 'Being confirmed by dispatch'}</dd>
            </div>
          </dl>

          <div className="btn-row emergency-actions">
            <Link href={`/bookings/${confirmed.publicId}`} className="btn btn-large btn-primary">
              Track your ambulance
            </Link>
            <a href="tel:911" className="btn btn-large btn-danger">
              Call 911
            </a>
          </div>
        </div>

        <p className="emergency-note">
          This page will refresh automatically if dispatch updates your booking.
          For life-threatening emergencies, always call your local emergency number first.
        </p>
      </>
    );
  }

  return (
    <>
      <div className="emergency-hero">
        <div className="emergency-icon" aria-hidden="true">
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12 2v4M12 22v-4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M22 12h-4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round" />
          </svg>
        </div>
        <h1 className="emergency-title">Medical emergency?</h1>
        <p className="emergency-sub">
          Request an ambulance in one tap. Your location is sent automatically so
          dispatch can find the nearest crew immediately.
        </p>
      </div>

      {error && (
        <div className="alert alert-error" role="alert" aria-live="assertive">
          {error}
        </div>
      )}

      {pickup.geoError && (
        <div className="alert alert-amber" role="alert">
          {pickup.geoError}
        </div>
      )}

      {!pickup.latitude && !pickup.geoError && (
        <p className="emergency-location-status">
          {pickup.locating ? 'Finding your location…' : 'Locating your device…'}
        </p>
      )}

      <form onSubmit={handleEmergency} noValidate>
        <button
          type="submit"
          className="btn btn-large btn-danger emergency-primary-action"
          disabled={submitting || pickup.locating || !pickup.latitude}
        >
          {submitting ? 'Requesting ambulance…' : pickup.latitude ? 'Request emergency ambulance' : 'Locating…'}
        </button>
        <p className="emergency-hint">
          By tapping above you confirm this is a medical emergency and you want an
          ambulance dispatched to your current location.
        </p>
      </form>

      <div className="emergency-alternatives">
        <a href="tel:911" className="btn-call-emergency">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63 1.06 19.5 19.5 0 0 1-8.38-2.68 19.79 19.79 0 0 1-6.87-5.85 19.47 19.47 0 0 1-3.42-8.41 19.79 19.79 0 0 1-1.06-2.18 2 2 0 0 1 2.18-2h3Z" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span>Call 911 now</span>
        </a>
        <p className="emergency-note">
          For life-threatening emergencies, always call your local emergency number first.
          ABS books and coordinates ambulance transport — it does not replace 911 / 112.
        </p>
      </div>
    </>
  );
}
