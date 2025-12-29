import type { GeoJSONFeature, GeoJSONFeatureCollection } from "@/lib/types";
import { parseBulgarianDateTime } from "../shared/date-utils";
import type { RawIncident } from "./types";
import { createGeometry } from "./geometry";

/**
 * Build GeoJSON FeatureCollection from incident
 */
export function buildGeoJSON(
  incident: RawIncident
): GeoJSONFeatureCollection | null {
  const geometry = createGeometry(incident);
  if (!geometry) {
    return null;
  }

  // Parse dates to ISO format for easier filtering in the app
  let startTimeISO: string | undefined;
  let endTimeISO: string | undefined;

  try {
    if (incident.begin_event) {
      startTimeISO = parseBulgarianDateTime(incident.begin_event).toISOString();
    }
  } catch (error) {
    console.warn(`   ⚠️  Invalid start date format: ${incident.begin_event}`);
  }

  try {
    if (incident.end_event) {
      endTimeISO = parseBulgarianDateTime(incident.end_event).toISOString();
    }
  } catch (error) {
    console.warn(`   ⚠️  Invalid end date format: ${incident.end_event}`);
  }

  const feature: GeoJSONFeature = {
    type: "Feature",
    geometry,
    properties: {
      eventId: incident.ceo,
      cityName: incident.city_name,
      eventType: incident.typedist,
      startTime: incident.begin_event, // Original Bulgarian format for display
      endTime: incident.end_event, // Original Bulgarian format for display
      startTimeISO, // Parsed ISO format for filtering
      endTimeISO, // Parsed ISO format for filtering
    },
  };

  return {
    type: "FeatureCollection",
    features: [feature],
  };
}

/**
 * Build markdown message for incident
 */
export function buildMessage(incident: RawIncident): string {
  const lines: string[] = [];

  // Title
  lines.push(`**${incident.typedist}**\n`);

  // Location
  if (incident.city_name) {
    lines.push(`**Населено място:** ${incident.city_name}`);
  }

  // Time range
  if (incident.begin_event) {
    lines.push(`**Начало:** ${incident.begin_event}`);
  }
  if (incident.end_event) {
    lines.push(`**Край:** ${incident.end_event}`);
  }

  // Grid identifier
  if (incident.ceo) {
    lines.push(`**Мрежов код:** ${incident.ceo}`);
  }

  return lines.join("\n");
}

/**
 * Build title for incident
 */
export function buildTitle(incident: RawIncident): string {
  const parts: string[] = [];

  // Incident type
  parts.push(incident.typedist);

  // Location
  if (incident.city_name) {
    parts.push(incident.city_name);
  }

  // Grid code
  if (incident.ceo) {
    parts.push(incident.ceo);
  }

  return parts.join(" - ");
}
