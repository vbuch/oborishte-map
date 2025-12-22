/**
 * Shared utilities for geocoding services
 */

// Sofia bounding box (approximate administrative boundaries)
// southwest: [23.188, 42.605], northeast: [23.528, 42.788]
export const SOFIA_BOUNDS = {
  south: 42.605,
  west: 23.188,
  north: 42.788,
  east: 23.528,
};

/**
 * Sofia city center coordinates (used as reference point)
 */
export const SOFIA_CENTER = { lat: 42.6977, lng: 23.3219 };

/**
 * Sofia bounding box in bbox format (south,west,north,east)
 */
export const SOFIA_BBOX = `${SOFIA_BOUNDS.south},${SOFIA_BOUNDS.west},${SOFIA_BOUNDS.north},${SOFIA_BOUNDS.east}`;

/**
 * Check if coordinates are within Sofia's administrative boundaries
 */
export function isWithinSofia(lat: number, lng: number): boolean {
  return (
    lat >= SOFIA_BOUNDS.south &&
    lat <= SOFIA_BOUNDS.north &&
    lng >= SOFIA_BOUNDS.west &&
    lng <= SOFIA_BOUNDS.east
  );
}
