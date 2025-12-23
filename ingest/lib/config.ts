/**
 * Geocoding configuration
 */

export type GeocodingAlgorithm = "google_geocoding" | "overpass";

// Configuration: Choose which geocoding algorithm to use for STREETS
// - overpass: OpenStreetMap Overpass API + Turf.js (most accurate for intersections, uses real OSM geometries)
export const STREET_GEOCODING_ALGO: GeocodingAlgorithm = "overpass";

// Configuration: Choose which geocoding algorithm to use for PINS (specific addresses)
// - google_geocoding: Google Geocoding API (most reliable for specific addresses with house numbers)
// - overpass: OpenStreetMap Nominatim (free but less accurate for specific addresses)
export const PIN_GEOCODING_ALGO: GeocodingAlgorithm = "google_geocoding";

// Legacy: Keep for backwards compatibility (uses street geocoding algo)
export const GEOCODING_ALGO: GeocodingAlgorithm = STREET_GEOCODING_ALGO;

// Log the active configuration
console.log(`🗺️ Street Geocoding: ${STREET_GEOCODING_ALGO}`);
console.log(`📍 Pin Geocoding: ${PIN_GEOCODING_ALGO}`);

// Get the appropriate data extraction prompt based on geocoding algorithm
export function getDataExtractionPromptPath(): string {
  // Use street geocoding algo for prompt selection (affects intersection format)
  switch (STREET_GEOCODING_ALGO) {
    case "overpass":
      return "prompts/data-extraction-overpass.md";

    case "google_geocoding":
    default:
      return "prompts/data-extraction.md";
  }
}
