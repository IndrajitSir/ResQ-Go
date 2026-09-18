'use client';

import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import type { TripLocationView } from '@abs/contracts';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix leaflet default marker icons in webpack/next.js
const iconSvg = (color: string, size: number) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10" fill="${color}" stroke="white" stroke-width="2"/>
  </svg>`;

const pickupIcon = L.divIcon({
  className: '',
  html: iconSvg('#2563eb', 20),
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

const ambulanceIcon = L.divIcon({
  className: '',
  html: `<div style="position:relative">
    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24">
      <rect x="2" y="6" width="20" height="12" rx="2" fill="#dc2626" stroke="white" stroke-width="1.5"/>
      <text x="12" y="15" text-anchor="middle" font-size="9" fill="white" font-weight="bold">🚑</text>
    </svg>
  </div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

/** Re-centres the map when the ambulance moves. */
function AutoPan({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, Math.max(map.getZoom(), 13), { duration: 1.2 });
  }, [center, map]);
  return null;
}

interface LiveMapProps {
  pickupLatitude: number;
  pickupLongitude: number;
  pickupLabel?: string;
  liveLocation?: TripLocationView;
  className?: string;
}

/**
 * Interactive map showing the pickup point (blue dot), the ambulance's latest
 * position (red marker), and a straight-line route between them.
 */
export default function LiveMap({
  pickupLatitude,
  pickupLongitude,
  pickupLabel,
  liveLocation,
  className,
}: LiveMapProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const center: [number, number] = useMemo(() => {
    if (liveLocation) return [liveLocation.latitude, liveLocation.longitude];
    return [pickupLatitude, pickupLongitude];
  }, [liveLocation, pickupLatitude, pickupLongitude]);

  const ambulancePos: [number, number] | null = liveLocation
    ? [liveLocation.latitude, liveLocation.longitude]
    : null;

  const routePoints: [number, number][] = useMemo(() => {
    if (!ambulancePos) return [];
    return [ambulancePos, [pickupLatitude, pickupLongitude]];
  }, [ambulancePos, pickupLatitude, pickupLongitude]);

  // Don't render the map during SSR (leaflet needs window).
  if (!mounted) {
    return (
      <div
        className={className}
        style={{ height: 280, borderRadius: 'var(--radius)', background: '#e5e7eb' }}
        aria-label="Map loading…"
      />
    );
  }

  return (
    <div
      className={className}
      style={{ height: 280, borderRadius: 'var(--radius)', overflow: 'hidden', position: 'relative' }}
    >
      <MapContainer
        center={center}
        zoom={ambulancePos ? 14 : 13}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        {/* Pickup point */}
        <Marker position={[pickupLatitude, pickupLongitude]} icon={pickupIcon}>
        </Marker>
        {/* Ambulance position */}
        {ambulancePos && (
          <>
            <Marker position={ambulancePos} icon={ambulanceIcon} />
            <AutoPan center={ambulancePos} />
          </>
        )}
        {/* Route line */}
        {routePoints.length === 2 && (
          <Polyline
            positions={routePoints}
            pathOptions={{ color: '#dc2626', weight: 3, dashArray: '8 6', opacity: 0.8 }}
          />
        )}
      </MapContainer>
    </div>
  );
}
