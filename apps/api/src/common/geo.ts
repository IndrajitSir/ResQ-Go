/**
 * Geodesic helpers used for dispatch ranking and progress estimates.
 *
 * Straight-line (great-circle) distances are intentional: they need no external
 * provider, they are deterministic, and they are honest about being estimates.
 * When a routing provider is introduced, replace `estimateMinutes` only.
 */

export interface Coordinates {
  latitude: number;
  longitude: number;
}

const EARTH_RADIUS_KM = 6371;
const DEGREES_TO_RADIANS = Math.PI / 180;

/** Great-circle distance between two WGS-84 points, in kilometres. */
export function haversineKm(from: Coordinates, to: Coordinates): number {
  const deltaLat = (to.latitude - from.latitude) * DEGREES_TO_RADIANS;
  const deltaLon = (to.longitude - from.longitude) * DEGREES_TO_RADIANS;
  const lat1 = from.latitude * DEGREES_TO_RADIANS;
  const lat2 = to.latitude * DEGREES_TO_RADIANS;

  const a =
    Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Rounds to one decimal place so API responses stay stable and readable. */
export function roundKm(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Converts a distance into an ETA. When the vehicle is not reporting speed we
 * assume a conservative urban average rather than pretending to know better.
 */
export function estimateMinutes(
  distanceKm: number,
  speedKph?: number,
  fallbackKph = 30,
): number {
  const effectiveSpeed = speedKph && speedKph > 5 ? speedKph : fallbackKph;
  return Math.max(1, Math.round((distanceKm / effectiveSpeed) * 60));
}
