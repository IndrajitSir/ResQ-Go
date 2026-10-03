'use client';

import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import type { TripLocationView } from '@abs/contracts';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

/** Markers are built as inline SVG div icons so no sprite assets are needed. */
const dotIcon = (color: string, ring: string, size: number) =>
  L.divIcon({
    className: '',
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" fill="${color}" stroke="${ring}" stroke-width="2.5"/>
    </svg>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });

const pickupIcon = dotIcon('var(--accent)', '#ffffff', 22);
const destinationIcon = L.divIcon({
  className: '',
  html: `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24">
    <rect x="3" y="3" width="18" height="18" rx="4" fill="var(--signal-critical)" stroke="#ffffff" stroke-width="2.5"/>
  </svg>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

const ambulanceIcon = L.divIcon({
  className: '',
  html: `<div class="map-vehicle">
    <span class="map-vehicle__pulse" aria-hidden="true"></span>
    <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24">
      <rect x="1.5" y="6.5" width="21" height="12" rx="3" fill="var(--signal-critical)" stroke="#ffffff" stroke-width="1.6"/>
      <path d="M9.4 10.2v5.2M6.8 12.8h5.2" stroke="#fff" stroke-width="1.7" stroke-linecap="round"/>
    </svg>
  </div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

/** Re-centres the map as the crew moves, without fighting manual panning. */
function AutoPan({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, Math.max(map.getZoom(), 13), { duration: 1.1 });
  }, [center, map]);
  return null;
}

interface LiveMapProps {
  pickupLatitude: number;
  pickupLongitude: number;
  pickupLabel?: string;
  destinationLatitude?: number;
  destinationLongitude?: number;
  destinationLabel?: string;
  liveLocation?: TripLocationView;
  className?: string;
  /** Taller variant used by the dispatch console. */
  tall?: boolean;
}

/**
 * Interactive map of the pickup point, the receiving facility, and the crew's
 * latest known position.
 *
 * The straight line between two points is a straight line: it is a visual aid
 * only and is never presented as a routed distance. Real distance and ETA come
 * from the API.
 */
export default function LiveMap({
  pickupLatitude,
  pickupLongitude,
  pickupLabel,
  destinationLatitude,
  destinationLongitude,
  destinationLabel,
  liveLocation,
  className = '',
  tall = false,
}: LiveMapProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const hasDestination =
    typeof destinationLatitude === 'number' && typeof destinationLongitude === 'number';

  const ambulancePos = useMemo<[number, number] | null>(
    () => (liveLocation ? [liveLocation.latitude, liveLocation.longitude] : null),
    [liveLocation],
  );

  const center = useMemo<[number, number]>(
    () => ambulancePos ?? [pickupLatitude, pickupLongitude],
    [ambulancePos, pickupLatitude, pickupLongitude],
  );

  // Draw the leg the crew is actually travelling: towards the facility once the
  // patient is on board, otherwise towards the pickup. Derived inside useMemo
  // so the dependency is a stable value rather than a fresh array each render.
  const routePoints = useMemo<[number, number][]>(() => {
    if (!ambulancePos) return [];
    const target: [number, number] = hasDestination
      ? [destinationLatitude, destinationLongitude]
      : [pickupLatitude, pickupLongitude];
    return [ambulancePos, target];
  }, [ambulancePos, hasDestination, destinationLatitude, destinationLongitude, pickupLatitude, pickupLongitude]);

  const description = [
    pickupLabel ? `Pickup at ${pickupLabel}.` : 'Pickup point shown.',
    hasDestination ? `Destination: ${destinationLabel ?? 'receiving facility'}.` : '',
    ambulancePos
      ? 'The ambulance position is the last one reported by the crew and may lag behind.'
      : 'No crew position has been reported yet.',
  ]
    .filter(Boolean)
    .join(' ');

  // Leaflet needs the DOM; render a reserved box so layout never shifts.
  if (!mounted) {
    return (
      <div
        className={`map-shell map-shell--placeholder ${tall ? 'map-shell--tall' : ''} ${className}`.trim()}
        role="status"
        aria-label="Loading map"
      >
        Loading map…
      </div>
    );
  }

  return (
    <>
      <div
        className={`map-shell ${tall ? 'map-shell--tall' : ''} ${className}`.trim()}
        role="img"
        aria-label={description}
      >
        <MapContainer
          center={center}
          zoom={ambulancePos ? 14 : 13}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={false}
          attributionControl
        >
          {/* Attribution is required by the OpenStreetMap tile usage policy. */}
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />

          <Marker position={[pickupLatitude, pickupLongitude]} icon={pickupIcon} />

          {hasDestination ? (
            <Marker
              position={[destinationLatitude, destinationLongitude]}
              icon={destinationIcon}
            />
          ) : null}

          {ambulancePos ? (
            <>
              <Marker position={ambulancePos} icon={ambulanceIcon} />
              <AutoPan center={ambulancePos} />
            </>
          ) : null}

          {routePoints.length === 2 ? (
            <Polyline
              positions={routePoints}
              pathOptions={{
                // Literal colour: Leaflet writes this as an SVG presentation
                // attribute, where CSS custom properties do not resolve.
                color: '#d92d3c',
                weight: 3,
                dashArray: '8 6',
                opacity: 0.85,
              }}
            />
          ) : null}
        </MapContainer>
      </div>
      <p className="visually-hidden">{description}</p>
    </>
  );
}