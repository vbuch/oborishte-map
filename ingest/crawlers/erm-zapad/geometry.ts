import { convex, featureCollection, point as turfPoint } from "@turf/turf";
import type {
  GeoJSONMultiPoint,
  GeoJSONPoint,
  GeoJSONPolygon,
} from "@/lib/types";
import type { RawIncident } from "./types";
import { extractCustomerPoints } from "./extractors";

/**
 * Create GeoJSON geometry from incident data
 */
export function createGeometry(
  incident: RawIncident
): GeoJSONPoint | GeoJSONMultiPoint | GeoJSONPolygon | null {
  const centerLat = Number.parseFloat(incident.lat);
  const centerLon = Number.parseFloat(incident.lon);

  if (Number.isNaN(centerLat) || Number.isNaN(centerLon)) {
    return null;
  }

  const customerCoords = extractCustomerPoints(incident.points);
  const customerCount = customerCoords.length;

  // No customer points: use center point
  if (customerCount === 0) {
    return {
      type: "Point",
      coordinates: [centerLon, centerLat],
    };
  }

  // 1-2 customer points: create MultiPoint
  if (customerCount <= 2) {
    return {
      type: "MultiPoint",
      coordinates: customerCoords,
    };
  }

  // 3+ customer points: create Polygon using convex hull
  try {
    const points = customerCoords.map(([lon, lat]) => turfPoint([lon, lat]));
    const collection = featureCollection(points);
    const hull = convex(collection);

    if (hull?.geometry.type === "Polygon") {
      return hull.geometry as GeoJSONPolygon;
    }

    // Convex hull failed (collinear points) - fall back to MultiPoint
    return {
      type: "MultiPoint",
      coordinates: customerCoords,
    };
  } catch (error) {
    console.warn(
      `   ⚠️  Convex hull failed for ${incident.ceo}, using MultiPoint:`,
      error
    );
    return {
      type: "MultiPoint",
      coordinates: customerCoords,
    };
  }
}
