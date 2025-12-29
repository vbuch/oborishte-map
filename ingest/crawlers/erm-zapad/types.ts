import type { GeoJSONFeatureCollection } from "@/lib/types";

/**
 * Customer point with coordinates
 */
export interface CustomerPoint {
  lat: string;
  lon: string;
}

/**
 * Points object containing customer locations
 */
export interface IncidentPoints {
  cnt: string; // Count of customer points
  [key: string]: string | CustomerPoint; // Numbered points: "1", "2", "3", etc.
}

/**
 * Raw incident data from ERM-Zapad API
 */
export interface RawIncident {
  ceo: string; // Grid identifier (e.g., "SF_2742")
  lat: string; // Center latitude
  lon: string; // Center longitude
  typedist: string; // Incident type: "планирано" or "непланирано"
  type_event: string; // Event type code
  begin_event: string; // Start datetime (format: "DD.MM.YYYY HH:MM")
  end_event: string; // End datetime (format: "DD.MM.YYYY HH:MM")
  city_name: string; // Settlement name
  grid_id: string; // Grid ID (often empty)
  cities: string; // Affected cities (often empty)
  points: IncidentPoints; // Customer point locations
}

/**
 * API response format: object with incident IDs as keys
 */
export interface ApiResponse {
  [incidentId: string]: RawIncident;
}

/**
 * Municipality information
 */
export interface Municipality {
  code: string; // e.g., "SOF15", "SOF16"
  name: string; // e.g., "ИСКЪР", "ПАНЧАРЕВО"
}

/**
 * Source document for ERM-Zapad incidents (stored in Firestore)
 */
export interface ErmZapadSourceDocument {
  url: string; // Unique identifier URL
  datePublished: string; // ISO format date
  title: string; // Human-readable title
  message: string; // Markdown-formatted description
  sourceType: "erm-zapad";
  crawledAt: Date;
  geoJson: GeoJSONFeatureCollection; // Pre-computed geographic data
}

/**
 * Crawl summary statistics
 */
export interface CrawlSummary {
  saved: number;
  skipped: number;
  failed: number;
}
