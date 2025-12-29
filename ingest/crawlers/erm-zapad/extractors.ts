import type { CustomerPoint, RawIncident } from "./types";

/**
 * Extract customer point coordinates from incident
 */
export function extractCustomerPoints(
  points: RawIncident["points"]
): Array<[number, number]> {
  const count = Number.parseInt(points.cnt, 10);
  if (Number.isNaN(count) || count === 0) {
    return [];
  }

  const coords: Array<[number, number]> = [];

  for (let i = 1; i <= count; i++) {
    const point = points[String(i)] as CustomerPoint | undefined;
    if (
      point &&
      typeof point === "object" &&
      "lat" in point &&
      "lon" in point
    ) {
      const lat = Number.parseFloat(point.lat);
      const lon = Number.parseFloat(point.lon);

      if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
        coords.push([lon, lat]); // GeoJSON format: [lng, lat]
      }
    }
  }

  return coords;
}
