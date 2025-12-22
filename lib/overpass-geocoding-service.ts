import { Address } from "./types";
import * as turf from "@turf/turf";
import type { Feature, MultiLineString, Position } from "geojson";
import {
  SOFIA_BOUNDS,
  SOFIA_CENTER,
  SOFIA_BBOX,
  isWithinSofia,
} from "./geocoding-utils";
import { delay } from "./delay";

// Constants for API rate limiting
const OVERPASS_DELAY_MS = 500; // 500ms for Overpass API (generous limits)
const BUFFER_DISTANCE_METERS = 30; // Buffer distance for street geometries

// Multiple Overpass API instances for fallback
const OVERPASS_INSTANCES = [
  "https://overpass.private.coffee/api/interpreter", // No rate limit
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter", // No rate limit (Russia)
  "https://overpass-api.de/api/interpreter", // Main instance (10k queries/day)
  "https://overpass.osm.jp/api/interpreter", // Japan instance
];

/**
 * Normalize street name for better OSM matching
 * - Removes street type prefixes (бул., ул., площад, пл.)
 * - Removes all quote styles (ASCII and Unicode)
 * - Normalizes whitespace
 */
function normalizeStreetName(streetName: string): string {
  return streetName
    .toLowerCase()
    .replaceAll(/^(бул\.|ул\.|площад|пл\.)\s*/g, "")
    .replaceAll(/["""„"'`''‚«»‹›]/g, "") // Remove ALL quote styles
    .replaceAll(/\s+/g, " ") // Normalize whitespace
    .trim();
}

/**
 * Get street geometry from Overpass API (OpenStreetMap)
 * Returns actual LineString geometries from OSM, preserving way structure
 */
async function getStreetGeometryFromOverpass(
  streetName: string
): Promise<Feature<MultiLineString> | null> {
  try {
    // Normalize street name for better OSM matching
    const normalizedName = normalizeStreetName(streetName);

    // Check if this is a square/plaza (площад/пл.)
    const isSquare = streetName.toLowerCase().match(/^(площад|пл\.)\s*/);

    // Overpass QL query to find the street by name
    // For squares, search for place=square nodes/areas
    // For streets (ул.), include residential roads in addition to main highways
    const isStreet = streetName.toLowerCase().includes("ул.");

    let query: string;

    if (isSquare) {
      // Search for squares as nodes or ways with place=square
      query = `
        [out:json][timeout:25];
        (
          node["place"="square"]["name"~"${normalizedName}",i](${SOFIA_BBOX});
          way["place"="square"]["name"~"${normalizedName}",i](${SOFIA_BBOX});
          node["place"="square"]["name:bg"~"${normalizedName}",i](${SOFIA_BBOX});
          way["place"="square"]["name:bg"~"${normalizedName}",i](${SOFIA_BBOX});
        );
        out geom;
      `;
    } else {
      // Search for streets/boulevards
      const highwayFilter = isStreet
        ? '["highway"~"^(primary|secondary|tertiary|trunk|residential|unclassified|living_street)$"]'
        : '["highway"~"^(primary|secondary|tertiary|trunk)$"]';

      // Use fuzzy matching with regex contains instead of exact match
      query = `
        [out:json][timeout:25];
        (
          way${highwayFilter}["name"~"${normalizedName}",i](${SOFIA_BBOX});
          way${highwayFilter}["name:bg"~"${normalizedName}",i](${SOFIA_BBOX});
        );
        out geom;
      `;
    }

    // Try each Overpass instance until one works
    let responseData: any = null;
    let lastError: Error | null = null;

    for (const instance of OVERPASS_INSTANCES) {
      try {
        const response = await fetch(instance, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: `data=${encodeURIComponent(query)}`,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        responseData = await response.json();
        break; // Success, exit loop
      } catch (error) {
        console.log(`   ✗ Failed with ${new URL(instance).hostname}: ${error}`);
        lastError = error as Error;
        continue; // Try next instance
      }
    }

    if (!responseData) {
      throw lastError || new Error("All Overpass instances failed");
    }

    if (!responseData.elements || responseData.elements.length === 0) {
      // No OSM ways found - API request succeeded but no data for this street name
      console.log(`❌ Couldn't find: "${streetName}"`);
      return null;
    }

    // Build MultiLineString with each OSM way as a separate LineString
    // For squares (nodes), create a small point geometry
    const lineStrings: Position[][] = [];
    let totalPoints = 0;

    for (const element of responseData.elements) {
      if (element.type === "node") {
        // Square represented as a point - create a small box around it
        const lat = element.lat;
        const lon = element.lon;
        const offset = 0.0001; // ~10 meters
        lineStrings.push([
          [lon - offset, lat - offset],
          [lon + offset, lat + offset],
        ]);
        totalPoints += 2;
      } else if (
        element.type === "way" &&
        element.geometry &&
        element.geometry.length >= 2
      ) {
        // Round coordinates to 6 decimal places (≈ 0.1m accuracy)
        const coordinates: Position[] = element.geometry.map((point: any) => [
          Math.round(point.lon * 1000000) / 1000000,
          Math.round(point.lat * 1000000) / 1000000,
        ]);
        lineStrings.push(coordinates);
        totalPoints += coordinates.length;
      }
    }

    if (lineStrings.length === 0) {
      console.log(
        `   ℹ️  No valid geometries in response for: "${streetName}"`
      );
      return null;
    }

    console.log(
      `✅ Found ${lineStrings.length} way segments with ${totalPoints} total points for: ${streetName}`
    );

    const multiLineString: Feature<MultiLineString> = {
      type: "Feature",
      properties: { name: streetName },
      geometry: {
        type: "MultiLineString",
        coordinates: lineStrings,
      },
    };

    return multiLineString;
  } catch (error) {
    console.error(`Error fetching from Overpass for ${streetName}:`, error);
    return null;
  }
}

/**
 * Find geometric intersection between two street geometries
 */
function findGeometricIntersection(
  street1: Feature<MultiLineString>,
  street2: Feature<MultiLineString>
): { lat: number; lng: number } | null {
  try {
    // First, try exact intersection using turf.lineIntersect
    const intersections = turf.lineIntersect(street1, street2);

    if (intersections.features.length > 0) {
      console.log(
        `   Found ${intersections.features.length} exact intersection(s)`
      );

      if (intersections.features.length === 1) {
        const point = intersections.features[0].geometry.coordinates;
        console.log(
          `   ✅ Intersection at: [${point[1].toFixed(6)}, ${point[0].toFixed(
            6
          )}]`
        );
        return { lng: point[0], lat: point[1] };
      }

      // Multiple intersections - use Sofia city center as reference point
      const target = SOFIA_CENTER;
      const targetPoint = turf.point([target.lng, target.lat]);

      const intersectionsWithDistance = intersections.features.map(
        (feature) => {
          const coords = feature.geometry.coordinates;
          const distance = turf.distance(targetPoint, feature, {
            units: "meters",
          });
          return {
            lat: coords[1],
            lng: coords[0],
            distance: distance,
          };
        }
      );

      // Sort by distance from Sofia center
      intersectionsWithDistance.sort((a, b) => a.distance - b.distance);

      const best = intersectionsWithDistance[0];
      console.log(
        `   ✅ Using closest to Sofia center: [${best.lat.toFixed(
          6
        )}, ${best.lng.toFixed(6)}] (${best.distance.toFixed(0)}m away)`
      );

      return { lng: best.lng, lat: best.lat };
    }

    // If no exact intersection, find nearest points
    console.log(`   No exact intersections, finding nearest points...`);

    // Buffer the streets slightly to account for small gaps
    const buffered1 = turf.buffer(street1, BUFFER_DISTANCE_METERS, {
      units: "meters",
    });
    const buffered2 = turf.buffer(street2, BUFFER_DISTANCE_METERS, {
      units: "meters",
    });

    if (!buffered1 || !buffered2) {
      console.warn(`   Could not create buffers`);
      return null;
    }

    // Try intersection on buffered geometries
    const bufferedIntersection = turf.intersect(
      turf.featureCollection([buffered1, buffered2])
    );

    if (bufferedIntersection) {
      const center = turf.center(bufferedIntersection);
      const coords = center.geometry.coordinates;
      console.log(`   Found buffered intersection`);
      return { lng: coords[0], lat: coords[1] };
    }

    // Last resort: find nearest point between the two lines
    let minDistance = Number.POSITIVE_INFINITY;
    let bestPoint: { lat: number; lng: number } | null = null;

    for (const line1 of street1.geometry.coordinates) {
      for (const line2 of street2.geometry.coordinates) {
        const lineString1 = turf.lineString(line1);
        const lineString2 = turf.lineString(line2);

        // Sample points along both lines
        for (const point1 of line1) {
          const pt1 = turf.point(point1);
          const nearest = turf.nearestPointOnLine(lineString2, pt1);
          const dist = turf.distance(pt1, nearest, { units: "meters" });

          if (dist < minDistance) {
            minDistance = dist;
            const coords = nearest.geometry.coordinates;
            bestPoint = { lng: coords[0], lat: coords[1] };
          }
        }
      }
    }

    if (bestPoint && minDistance < 200) {
      // 200m threshold
      console.log(
        `✅ Found nearest point at: [${bestPoint.lat.toFixed(
          6
        )}, ${bestPoint.lng.toFixed(6)}] (${minDistance.toFixed(1)}m gap)`
      );
      return bestPoint;
    }

    console.warn(
      `   Streets too far apart (${minDistance.toFixed(
        1
      )}m), no valid intersection`
    );
    return null;
  } catch (error) {
    console.error(`Error finding intersection:`, error);
    return null;
  }
}

/**
 * Main geocoding function using Overpass API and Turf.js
 */
export async function overpassGeocodeIntersections(
  intersections: string[]
): Promise<Address[]> {
  const results: Address[] = [];

  for (let i = 0; i < intersections.length; i++) {
    const intersection = intersections[i];

    const [street1Name, street2Name] = intersection
      .split("∩")
      .map((s) => s.trim());

    if (!street1Name || !street2Name) {
      console.error(`Invalid intersection format: ${intersection}`);
      continue;
    }

    try {
      // Fetch geometries from Overpass
      const geom1 = await getStreetGeometryFromOverpass(street1Name);
      const geom2 = await getStreetGeometryFromOverpass(street2Name);

      if (!geom1 || !geom2) {
        continue;
      }

      // Find intersection
      const intersectionPoint = findGeometricIntersection(geom1, geom2);

      if (intersectionPoint) {
        results.push({
          originalText: intersection,
          formattedAddress: intersection,
          coordinates: {
            lat: intersectionPoint.lat,
            lng: intersectionPoint.lng,
          },
          geoJson: {
            type: "Point",
            coordinates: [intersectionPoint.lng, intersectionPoint.lat],
          },
        });
      } else {
        console.error(`❌ Could not find intersection`);
      }
    } catch (error) {
      console.error(`Error processing ${intersection}:`, error);
    }

    // Rate limiting between requests
    if (i < intersections.length - 1) {
      await delay(OVERPASS_DELAY_MS);
    }
  }

  return results;
}

/**
 * Get street section geometry between two intersection points
 * Returns the actual OSM geometry of the street segment
 */
export async function getStreetSectionGeometry(
  streetName: string,
  startCoords: { lat: number; lng: number },
  endCoords: { lat: number; lng: number }
): Promise<Position[] | null> {
  try {
    console.log(
      `🔍 Finding street section: ${streetName} from [${startCoords.lat}, ${startCoords.lng}] to [${endCoords.lat}, ${endCoords.lng}]`
    );

    // Get full street geometry
    const streetGeometry = await getStreetGeometryFromOverpass(streetName);
    if (!streetGeometry) {
      console.warn(`   No geometry found for street: ${streetName}`);
      return null;
    }

    // Create points from coordinates
    const startPoint = turf.point([startCoords.lng, startCoords.lat]);
    const endPoint = turf.point([endCoords.lng, endCoords.lat]);

    // Find which segments contain or are near our start/end points
    const allSegments = streetGeometry.geometry.coordinates;
    let bestSection: Position[] | null = null;
    let minTotalDistance = Infinity;

    // Try each segment as a potential section
    for (const segment of allSegments) {
      if (segment.length < 2) continue;

      const line = turf.lineString(segment);

      // Check if both points are close to this segment
      const startSnapped = turf.nearestPointOnLine(line, startPoint);
      const endSnapped = turf.nearestPointOnLine(line, endPoint);

      const startDist = turf.distance(startPoint, startSnapped, {
        units: "meters",
      });
      const endDist = turf.distance(endPoint, endSnapped, { units: "meters" });

      // If both points are within 50m of this segment, it might be our section
      if (startDist < 50 && endDist < 50) {
        const totalDist = startDist + endDist;

        if (totalDist < minTotalDistance) {
          minTotalDistance = totalDist;

          // Extract the subsection between the two snapped points
          const startIndex = startSnapped.properties.index || 0;
          const endIndex = endSnapped.properties.index || segment.length - 1;

          const minIndex = Math.min(startIndex, endIndex);
          const maxIndex = Math.max(startIndex, endIndex);

          // Extract coordinates between the indices
          const section = segment.slice(minIndex, maxIndex + 2);
          bestSection = section;
        }
      }
    }

    if (bestSection && bestSection.length >= 2) {
      console.log(
        `   ✅ Found street section with ${bestSection.length} points`
      );
      return bestSection;
    }

    // Fallback: try to connect multiple segments
    console.log(
      `   ⚠️  No single segment found, trying to connect segments...`
    );

    // Build a path by connecting segments
    const connectedPath: Position[] = [];
    let currentPoint = startPoint;
    const usedSegments = new Set<number>();

    while (
      connectedPath.length === 0 ||
      turf.distance(
        turf.point(connectedPath[connectedPath.length - 1]),
        endPoint,
        { units: "meters" }
      ) > 10
    ) {
      // Find nearest unused segment to current point
      let nearestSegmentIdx = -1;
      let nearestDist = Infinity;
      let nearestSnap: any = null;

      for (let i = 0; i < allSegments.length; i++) {
        if (usedSegments.has(i)) continue;

        const segment = allSegments[i];
        if (segment.length < 2) continue;

        const line = turf.lineString(segment);
        const snapped = turf.nearestPointOnLine(line, currentPoint);
        const dist = turf.distance(currentPoint, snapped, { units: "meters" });

        if (dist < nearestDist) {
          nearestDist = dist;
          nearestSegmentIdx = i;
          nearestSnap = snapped;
        }
      }

      if (nearestSegmentIdx === -1 || nearestDist > 50) {
        console.log(
          `   ❌ Cannot connect segments (min dist: ${nearestDist}m)`
        );
        break;
      }

      // Add this segment
      usedSegments.add(nearestSegmentIdx);
      const segment = allSegments[nearestSegmentIdx];

      // Determine direction and add coordinates
      if (connectedPath.length === 0) {
        connectedPath.push(...segment);
      } else {
        // Check if we need to reverse
        const lastPoint = turf.point(connectedPath[connectedPath.length - 1]);
        const segmentStart = turf.point(segment[0]);
        const segmentEnd = turf.point(segment[segment.length - 1]);

        const distToStart = turf.distance(lastPoint, segmentStart, {
          units: "meters",
        });
        const distToEnd = turf.distance(lastPoint, segmentEnd, {
          units: "meters",
        });

        if (distToEnd < distToStart) {
          // Reverse and add
          connectedPath.push(...segment.slice().reverse());
        } else {
          connectedPath.push(...segment);
        }
      }

      currentPoint = turf.point(connectedPath[connectedPath.length - 1]);

      // Safety check
      if (usedSegments.size > 10) {
        console.log(`   ❌ Too many segments, giving up`);
        break;
      }
    }

    if (connectedPath.length >= 2) {
      console.log(
        `   ✅ Connected ${usedSegments.size} segments into path with ${connectedPath.length} points`
      );
      return connectedPath;
    }

    console.log(`   ❌ Could not extract street section`);
    return null;
  } catch (error) {
    console.error(`Error getting street section geometry:`, error);
    return null;
  }
}

/**
 * Geocode a specific address with house number using Nominatim
 */
async function geocodeAddressWithNominatim(
  address: string
): Promise<{ lat: number; lng: number } | null> {
  try {
    // Ensure address includes Sofia context
    const fullAddress =
      address.includes("София") || address.includes("Sofia")
        ? address
        : `${address}, София, България`;

    // Add bounded search to Sofia area and increase limit to filter results
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
      fullAddress
    )}&format=json&limit=5&addressdetails=1&bounded=1&viewbox=${
      SOFIA_BOUNDS.west
    },${SOFIA_BOUNDS.south},${SOFIA_BOUNDS.east},${SOFIA_BOUNDS.north}`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": "OborishteMap/1.0",
      },
    });

    if (!response.ok) {
      console.warn(`Nominatim API error: ${response.status}`);
      return null;
    }

    const data = await response.json();

    if (data && data.length > 0) {
      // Find first result that is actually within Sofia boundaries
      for (const result of data) {
        const coords = {
          lat: Number.parseFloat(result.lat),
          lng: Number.parseFloat(result.lon),
        };

        // Validate coordinates are within Sofia
        if (isWithinSofia(coords.lat, coords.lng)) {
          console.log(
            `   ✅ Nominatim geocoded: "${address}" → [${coords.lat}, ${coords.lng}]`
          );
          return coords;
        } else {
          console.warn(
            `   ⚠️  Nominatim result for "${address}" outside Sofia: [${coords.lat}, ${coords.lng}]`
          );
        }
      }

      console.warn(
        `   ❌ All Nominatim results for "${address}" are outside Sofia`
      );
      return null;
    }

    console.warn(`   ❌ Nominatim found no results for: "${address}"`);
    return null;
  } catch (error) {
    console.error(`Error geocoding with Nominatim for ${address}:`, error);
    return null;
  }
}

/**
 * Geocode individual addresses using Overpass API
 */
export async function overpassGeocodeAddresses(
  addresses: string[]
): Promise<Address[]> {
  const results: Address[] = [];

  for (let i = 0; i < addresses.length; i++) {
    const address = addresses[i];

    try {
      // Check if this is a specific address (contains number)
      // Pattern: "ул. Name Number" or "бул. Name Number"
      const hasNumber = /\d+/.test(address);

      let coords: { lat: number; lng: number } | null = null;

      if (hasNumber) {
        // Use Nominatim for specific addresses with house numbers
        console.log(`   Geocoding numbered address with Nominatim: ${address}`);
        coords = await geocodeAddressWithNominatim(address);
      } else {
        // Use Overpass for street names (get center of street)
        const geom = await getStreetGeometryFromOverpass(address);

        if (geom) {
          const centerPoint = turf.center(geom);
          const centerCoords = centerPoint.geometry.coordinates;
          coords = {
            lat: centerCoords[1],
            lng: centerCoords[0],
          };
        }
      }

      if (coords) {
        results.push({
          originalText: address,
          formattedAddress: address,
          coordinates: coords,
          geoJson: {
            type: "Point",
            coordinates: [coords.lng, coords.lat],
          },
        });
      } else {
        console.warn(`   ⚠️  Failed to geocode: ${address}`);
      }
    } catch (error) {
      console.error(`Error geocoding ${address}:`, error);
    }

    // Rate limiting
    if (i < addresses.length - 1) {
      await delay(OVERPASS_DELAY_MS);
    }
  }

  return results;
}
