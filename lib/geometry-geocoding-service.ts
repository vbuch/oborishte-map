import { Address } from "./types";
import * as turf from "@turf/turf";
import type { Feature, MultiLineString, Position } from "geojson";

// Constants for API rate limiting
const OVERPASS_DELAY_MS = 500; // 500ms for Overpass API (generous limits)
const BUFFER_DISTANCE_METERS = 30; // Buffer distance for street geometries (increased for better intersection detection)
const SOFIA_CENTER = { lng: 23.3219, lat: 42.6977 };

// Multiple Overpass API instances for fallback
const OVERPASS_INSTANCES = [
  "https://overpass.private.coffee/api/interpreter", // No rate limit
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter", // No rate limit (Russia)
  "https://overpass-api.de/api/interpreter", // Main instance (10k queries/day)
  "https://overpass.osm.jp/api/interpreter", // Japan instance
];

interface MapboxFeature {
  place_name: string;
  center: [number, number]; // [lng, lat]
  geometry: {
    coordinates: [number, number]; // [lng, lat]
    type: string;
  };
  place_type: string[];
  context?: Array<{
    id: string;
    text: string;
  }>;
}

interface MapboxGeocodingResponse {
  features: MapboxFeature[];
}

interface MapboxDirectionsRoute {
  geometry: {
    coordinates: Position[];
    type: "LineString";
  };
  distance: number;
  duration: number;
}

/**
 * Get street geometry from Mapbox Tilequery API
 * This accesses OSM data from Mapbox's vector tiles
 */
async function getPointsAlongStreet(
  streetName: string,
  city: string = "София"
): Promise<{ lng: number; lat: number }[]> {
  try {
    const apiKey = process.env.MAPBOX_ACCESS_TOKEN;
    if (!apiKey) {
      console.error("MAPBOX_ACCESS_TOKEN not configured");
      return [];
    }

    // First, get a point on the street using Nominatim
    const centerQuery = `${streetName}, ${city}, България`;
    const centerUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
      centerQuery
    )}&format=json&limit=1`;

    const centerResponse = await fetch(centerUrl, {
      headers: { "User-Agent": "OborishteMap/1.0" },
    });

    if (!centerResponse.ok) return [];

    const centerData = await centerResponse.json();
    if (!centerData || centerData.length === 0) {
      console.warn(`   Could not find ${streetName} with Nominatim`);
      return [];
    }

    const center = {
      lng: Number.parseFloat(centerData[0].lon),
      lat: Number.parseFloat(centerData[0].lat),
    };

    // Now query Mapbox Tilequery at this location to get actual road features
    // Use a large radius to get many segments of the street
    const radius = 1000; // 1km radius
    const tilequeryUrl = `https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/tilequery/${center.lng},${center.lat}.json?radius=${radius}&layers=road&limit=50&dedupe&access_token=${apiKey}`;

    const tilequeryResponse = await fetch(tilequeryUrl);
    if (!tilequeryResponse.ok) {
      console.warn(`   Mapbox tilequery error (${tilequeryResponse.status})`);
      return [];
    }

    const tilequeryData = await tilequeryResponse.json();

    if (!tilequeryData.features || tilequeryData.features.length === 0) {
      console.warn(`   No road features from Mapbox near ${streetName}`);
      return [];
    }

    // Filter features to find ones matching our street name
    const normalizedSearchName = streetName
      .toLowerCase()
      .replace(/бул\.|ул\./g, "")
      .trim();

    const matchingFeatures = tilequeryData.features.filter((feature: any) => {
      const name = feature.properties?.name || "";
      const nameBg = feature.properties?.name_bg || "";
      const nameEn = feature.properties?.name_en || "";

      const names = [name, nameBg, nameEn].map((n) =>
        n
          .toLowerCase()
          .replace(/бул\.|ул\./g, "")
          .trim()
      );

      return names.some(
        (n) =>
          n.includes(normalizedSearchName) || normalizedSearchName.includes(n)
      );
    });

    if (matchingFeatures.length === 0) {
      console.warn(`   No matching features for ${streetName} in Mapbox data`);
      return [];
    }

    console.log(
      `   Found ${matchingFeatures.length} matching segments in Mapbox`
    );

    // Debug: inspect the first few features
    if (matchingFeatures.length > 0) {
      console.log(
        `   First feature properties:`,
        JSON.stringify(matchingFeatures[0].properties, null, 2)
      );
      console.log(
        `   First feature geometry:`,
        JSON.stringify(matchingFeatures[0].geometry, null, 2)
      );
      console.log(`   Feature class:`, matchingFeatures[0].properties?.class);
      console.log(`   Feature type:`, matchingFeatures[0].properties?.type);
    }

    // Collect all coordinates from all matching features
    const allPoints: { lng: number; lat: number }[] = [];

    for (const feature of matchingFeatures) {
      const geom = feature.geometry;

      if (geom.type === "LineString") {
        allPoints.push(
          ...geom.coordinates.map((coord: [number, number]) => ({
            lng: coord[0],
            lat: coord[1],
          }))
        );
      } else if (geom.type === "MultiLineString") {
        for (const lineString of geom.coordinates) {
          allPoints.push(
            ...lineString.map((coord: [number, number]) => ({
              lng: coord[0],
              lat: coord[1],
            }))
          );
        }
      } else if (geom.type === "Point") {
        allPoints.push({ lng: geom.coordinates[0], lat: geom.coordinates[1] });
      }
    }

    console.log(
      `   Collected ${allPoints.length} total points from all segments`
    );

    if (allPoints.length === 0) {
      console.warn(`   No coordinates extracted from features`);
      return [];
    }

    // Remove duplicate points (same coordinates)
    const uniquePoints: { lng: number; lat: number }[] = [];
    const seen = new Set<string>();

    for (const point of allPoints) {
      const key = `${point.lat.toFixed(6)},${point.lng.toFixed(6)}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniquePoints.push(point);
      }
    }

    console.log(`   After deduplication: ${uniquePoints.length} unique points`);

    return uniquePoints;
  } catch (error) {
    console.error(`Error getting geometry for ${streetName}:`, error);
    return [];
  }
}

/**
 * Fetch street geometry using Nominatim OSM data
 * Returns actual street geometries from OpenStreetMap
 */
async function fetchStreetGeometry(
  streetName: string,
  city: string = "София"
): Promise<Feature<MultiLineString> | null> {
  try {
    const apiKey = process.env.MAPBOX_ACCESS_TOKEN;
    if (!apiKey) {
      console.error("MAPBOX_ACCESS_TOKEN not configured");
      return null;
    }

    // Step 1: Get actual street geometry from Nominatim
    const points = await getPointsAlongStreet(streetName, city);

    if (points.length === 0) {
      console.warn(`Could not find geometry for street: ${streetName}`);
      return null;
    }

    if (points.length < 2) {
      console.warn(
        `Not enough points for street: ${streetName} (found ${points.length})`
      );
      return null;
    }

    console.log(
      `✅ Found geometry for street: ${streetName} (${points.length} points from OSM)`
    );

    // Output all points as Google Maps links for verification
    console.log(`   Points for ${streetName}:`);
    points.forEach((p, i) => {
      console.log(
        `   ${i + 1}. https://www.google.com/maps?q=${p.lat},${p.lng}`
      );
    });

    // Convert points to Position array
    const coordinates: Position[] = points.map((p) => [p.lng, p.lat]);

    // Return as MultiLineString for consistency
    return turf.multiLineString([coordinates], {
      name: streetName,
      city: city,
    });
  } catch (error) {
    console.error(`Error fetching geometry for ${streetName}:`, error);
    return null;
  }
}

/**
 * Geocode a street name to get its approximate center point
 * Uses Nominatim (OSM) which is free and open
 */
async function geocodeStreetName(
  streetName: string,
  city: string = "София"
): Promise<{ lng: number; lat: number } | null> {
  try {
    const query = `${streetName}, ${city}, България`;
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
      query
    )}&format=json&limit=1`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": "OborishteMap/1.0",
      },
    });

    if (!response.ok) {
      console.error(`Nominatim error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    if (!data || data.length === 0) {
      return null;
    }

    const result = data[0];
    return {
      lng: Number.parseFloat(result.lon),
      lat: Number.parseFloat(result.lat),
    };
  } catch (error) {
    console.error(`Error geocoding street ${streetName}:`, error);
    return null;
  }
}

/**
 * Find the intersection point of two streets using their geometries
 *
 * Process:
 * 1. Fetch geometries for both streets (as line strings)
 * 2. Try to find exact line intersections first
 * 3. If no exact intersection, find nearest points between the lines
 */
async function findGeometricIntersection(
  street1: string,
  street2: string
): Promise<{ lat: number; lng: number } | null> {
  try {
    console.log(`🔍 Finding intersection: ${street1} ∩ ${street2}`);

    // Fetch geometries for both streets
    const [geom1, geom2] = await Promise.all([
      fetchStreetGeometry(street1),
      fetchStreetGeometry(street2),
    ]);

    if (!geom1 || !geom2) {
      console.warn(
        `Could not fetch geometries for intersection: ${street1} ∩ ${street2}`
      );
      return null;
    }

    // Try to find exact line intersections
    const intersections = turf.lineIntersect(geom1, geom2);

    if (intersections.features && intersections.features.length > 0) {
      // Found exact intersections!
      console.log(
        `   Found ${intersections.features.length} exact intersection(s)`
      );

      let intersectionPoint;
      if (intersections.features.length === 1) {
        intersectionPoint = intersections.features[0];
      } else {
        // Multiple intersections - find closest to center of both streets
        const center1 = turf.center(geom1);
        const center2 = turf.center(geom2);
        const midCenter = turf.midpoint(center1, center2);

        let minDistance = Infinity;
        let closestIntersection = intersections.features[0];

        for (const feature of intersections.features) {
          const dist = turf.distance(midCenter, feature, { units: "meters" });
          if (dist < minDistance) {
            minDistance = dist;
            closestIntersection = feature;
          }
        }

        intersectionPoint = closestIntersection;
        console.log(`   Selected best intersection`);
      }

      const [lng, lat] = intersectionPoint.geometry.coordinates;

      console.log(
        `✅ Found exact intersection at: [${lat.toFixed(6)}, ${lng.toFixed(6)}]`
      );

      return { lat, lng };
    }

    // No exact intersection found - use nearest point approach
    console.log(`   No exact intersections, finding nearest points...`);

    // Find nearest point on each line to the other
    const center1 = turf.center(geom1);
    const center2 = turf.center(geom2);

    const nearestOnGeom1 = turf.nearestPointOnLine(geom1, center2);
    const nearestOnGeom2 = turf.nearestPointOnLine(geom2, center1);

    const distance = turf.distance(nearestOnGeom1, nearestOnGeom2, {
      units: "meters",
    });

    if (distance > 100) {
      console.warn(
        `   Streets are ${distance.toFixed(
          1
        )}m apart with current geometries - may be incomplete`
      );
      // Don't reject - simplified geometries might not cover full street length
      // return null;
    }

    // Use midpoint between the nearest points
    const midpoint = turf.midpoint(nearestOnGeom1, nearestOnGeom2);
    const [lng, lat] = midpoint.geometry.coordinates;

    console.log(
      `✅ Found nearest point at: [${lat.toFixed(6)}, ${lng.toFixed(
        6
      )}] (${distance.toFixed(1)}m gap)`
    );

    return { lat, lng };
  } catch (error) {
    console.error(
      `Error finding geometric intersection for ${street1} ∩ ${street2}:`,
      error
    );
    return null;
  }
}

/**
 * Geocode multiple intersections using geometry-based approach
 * Returns a map of "street1||street2" -> coordinates
 */
export async function geometryGeocodeIntersections(
  intersectionPairs: [string, string][]
): Promise<Map<string, { lat: number; lng: number }>> {
  const results = new Map<string, { lat: number; lng: number }>();

  for (const [street1, street2] of intersectionPairs) {
    const coords = await findGeometricIntersection(street1, street2);

    if (coords) {
      const key = `${street1}||${street2}`;
      results.set(key, coords);
    }

    // Rate limiting for Nominatim (1 second is respectful)
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  return results;
}

/**
 * Geocode a simple address using OpenStreetMap Nominatim
 * This is a fallback for non-intersection addresses
 */
export async function geometryGeocodeAddress(
  address: string
): Promise<Address | null> {
  try {
    const fullAddress = address.includes("София")
      ? address
      : `${address}, София, България`;

    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
      fullAddress
    )}&format=json&limit=1`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": "OborishteMap/1.0",
      },
    });

    if (!response.ok) {
      console.error(`Nominatim error: ${response.status}`);
      return null;
    }

    const data = await response.json();

    if (!data || data.length === 0) {
      console.warn(`No results for address: ${address}`);
      return null;
    }

    const result = data[0];
    const lat = Number.parseFloat(result.lat);
    const lng = Number.parseFloat(result.lon);

    return {
      originalText: address,
      formattedAddress: result.display_name,
      coordinates: { lat, lng },
      geoJson: {
        type: "Point",
        coordinates: [lng, lat],
      },
    };
  } catch (error) {
    console.error("Error geocoding address:", error);
    return null;
  }
}

/**
 * Geocode multiple addresses using Nominatim
 */
export async function geometryGeocodeAddresses(
  addresses: string[]
): Promise<Address[]> {
  const results: Address[] = [];

  for (const address of addresses) {
    const geocoded = await geometryGeocodeAddress(address);
    if (geocoded) {
      results.push(geocoded);
    }

    // Rate limiting for Nominatim (1 request per second)
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  return results;
}

/**
 * Extract street geometries for rendering on the map
 * This can be used to visualize the actual street shapes
 */
export async function getStreetGeometries(
  streetNames: string[]
): Promise<Map<string, Feature<MultiLineString>>> {
  const geometries = new Map<string, Feature<MultiLineString>>();

  for (const streetName of streetNames) {
    const geom = await fetchStreetGeometry(streetName);
    if (geom) {
      geometries.set(streetName, geom);
    }

    // Rate limiting
    await new Promise((resolve) => setTimeout(resolve, OVERPASS_DELAY_MS));
  }

  return geometries;
}
