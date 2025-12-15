/**
 * Geocoding configuration
 */

export type GeocodingAlgorithm =
  | "google_geocoding"
  | "google_directions"
  | "mapbox_geocoding"
  | "overpass";

// Configuration: Choose which geocoding algorithm to use
// - google_geocoding: Google Geocoding API (reliable for all address types)
// - google_directions: Google Directions API (best for street geometries)
// - mapbox_geocoding: Mapbox Geocoding API (requires SECRET token for server-side use)
// - overpass: OpenStreetMap Overpass API + Turf.js (most accurate for intersections, uses real OSM geometries)
export const GEOCODING_ALGO: GeocodingAlgorithm = "overpass";

// Log the active configuration
console.log(`🗺️ Geocoding Algorithm: ${GEOCODING_ALGO}`);

// Get the appropriate data extraction prompt based on geocoding algorithm
export function getDataExtractionPromptPath(): string {
  switch (GEOCODING_ALGO) {
    case "google_directions":
      return "lib/prompts/data-extraction-directions.md";
    case "google_geocoding":
      return "lib/prompts/data-extraction.md";
    case "mapbox_geocoding":
      return "lib/prompts/data-extraction-mapbox.md";
    case "overpass":
      return "lib/prompts/data-extraction-overpass.md";
    default:
      return "lib/prompts/data-extraction.md";
  }
}
