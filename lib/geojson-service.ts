import {
  ExtractedData,
  StreetSection,
  GeoJSONFeatureCollection,
  GeoJSONFeature,
  GeoJSONPoint,
  GeoJSONLineString,
  GeoJSONPolygon,
  IntersectionCoordinates,
} from "./types";

// Cache for geocoding results and intersection lookups
const geocodingCache = new Map<string, IntersectionCoordinates | null>();
const intersectionCache = new Map<string, IntersectionCoordinates | null>();

// Step 1 — Address Normalization
export function normalizeAddress(address: string): string {
  let normalized = address
    // Remove smart quotes (curly quotes)
    .replace(/[„""]/g, '"')
    .replace(/['']/g, "'")
    // Replace № with space
    .replace(/№/g, " ")
    // Replace & with and
    .replace(/&/g, "and")
    // Normalize whitespace
    .replace(/\s+/g, " ")
    .trim();

  // Append ", Sofia, Bulgaria" if missing
  const lowerNormalized = normalized.toLowerCase();
  const hasSofia = lowerNormalized.includes("sofia");
  const hasBulgaria = lowerNormalized.includes("bulgaria");

  if (!hasSofia && !hasBulgaria) {
    normalized = `${normalized}, Sofia, Bulgaria`;
  } else if (hasSofia && !hasBulgaria) {
    normalized = `${normalized}, Bulgaria`;
  }

  return normalized;
}

// Step 2 — PIN / Address Geocoding (Points)
async function geocodePin(
  pin: string,
  preGeocodedAddresses?: Map<string, IntersectionCoordinates>
): Promise<GeoJSONFeature | null> {
  const normalizedPin = normalizeAddress(pin);

  // Check if we have a pre-geocoded address first
  if (preGeocodedAddresses?.has(pin)) {
    const coords = preGeocodedAddresses.get(pin)!;
    return {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [coords.lng, coords.lat],
      },
      properties: {
        feature_type: "pin",
        original_text: pin,
        normalized_text: normalizedPin,
        is_intersection: normalizedPin.includes("and"),
      },
    };
  }

  // Check cache
  if (geocodingCache.has(normalizedPin)) {
    const cached = geocodingCache.get(normalizedPin);
    if (!cached) return null;

    return {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [cached.lng, cached.lat],
      },
      properties: {
        feature_type: "pin",
        original_text: pin,
        normalized_text: normalizedPin,
        is_intersection: normalizedPin.includes("and"),
      },
    };
  }

  try {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    const encodedAddress = encodeURIComponent(normalizedPin);
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${apiKey}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status === "OK" && data.results && data.results.length > 0) {
      // Prefer results inside Sofia municipality
      let result = data.results[0];
      for (const res of data.results) {
        const addressComponents = res.address_components || [];
        const hasSofia = addressComponents.some(
          (comp: any) =>
            (comp.types.includes("locality") ||
              comp.types.includes("administrative_area_level_1")) &&
            comp.long_name.toLowerCase().includes("sofia")
        );
        if (hasSofia) {
          result = res;
          break;
        }
      }

      const coordinates = {
        lat: result.geometry.location.lat,
        lng: result.geometry.location.lng,
      };

      // Cache the result
      geocodingCache.set(normalizedPin, coordinates);

      return {
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [coordinates.lng, coordinates.lat],
        },
        properties: {
          feature_type: "pin",
          original_text: pin,
          normalized_text: normalizedPin,
          formatted_address: result.formatted_address,
          is_intersection: normalizedPin.includes("and"),
        },
      };
    }

    // Cache null result to avoid repeated failed requests
    geocodingCache.set(normalizedPin, null);
    return null;
  } catch (error) {
    console.error("Error geocoding pin:", error);
    return null;
  }
}

// Step 3 — Street Segment Endpoint Resolution

// Helper to geocode using Directions API for intersections
async function geocodeIntersectionViaDirections(
  streets: [string, string],
  apiKey: string
): Promise<IntersectionCoordinates | null> {
  console.log(`Streets: "${streets[0]}" & "${streets[1]}"`);

  // Strategy: Use Directions API to find the route between the two streets
  // The route will naturally go through their intersection point
  const origin = encodeURIComponent(streets[0]);
  const destination = encodeURIComponent(streets[1]);
  const directionsUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&mode=driving&key=${apiKey}`;

  const directionsResponse = await fetch(directionsUrl);
  const directionsData = await directionsResponse.json();

  if (
    directionsData.status === "OK" &&
    directionsData.routes &&
    directionsData.routes.length > 0
  ) {
    const route = directionsData.routes[0];
    const leg = route.legs[0];

    // Use the end location of the first step - this is typically after turning onto the destination street
    if (leg.steps && leg.steps.length > 0) {
      const intersectionPoint = leg.steps[0].end_location;
      const coordinates = {
        lat: intersectionPoint.lat,
        lng: intersectionPoint.lng,
      };

      const mapsLink = `https://www.google.com/maps/place/${coordinates.lat},${coordinates.lng}/@${coordinates.lat},${coordinates.lng},210m`;
      console.log(`Resolved intersection via Directions API:`, coordinates);
      console.log(`View on map: ${mapsLink}`);

      return coordinates;
    }
  }

  return null;
}

// Helper to geocode using Geocoding API
async function geocodeViaGeocodingAPI(
  query: string,
  apiKey: string
): Promise<IntersectionCoordinates | null> {
  const encodedAddress = encodeURIComponent(query);
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${apiKey}`;

  const response = await fetch(url);
  const data = await response.json();

  if (data.status === "OK" && data.results && data.results.length > 0) {
    // Prefer results inside Sofia municipality
    let result = data.results[0];
    for (const res of data.results) {
      const addressComponents = res.address_components || [];
      const hasSofia = addressComponents.some(
        (comp: any) =>
          (comp.types.includes("locality") ||
            comp.types.includes("administrative_area_level_1")) &&
          comp.long_name.toLowerCase().includes("sofia")
      );
      if (hasSofia) {
        result = res;
        break;
      }
    }

    const coordinates = {
      lat: result.geometry.location.lat,
      lng: result.geometry.location.lng,
    };

    const mapsLink = `https://www.google.com/maps/place/${coordinates.lat},${coordinates.lng}/@${coordinates.lat},${coordinates.lng},210m`;
    console.log(
      `Resolved via Geocoding API:`,
      coordinates,
      `(${result.formatted_address})`
    );
    console.log(`View on map: ${mapsLink}`);

    return coordinates;
  }

  return null;
}

// Helper to geocode an intersection (contains " & ")
async function geocodeIntersection(
  address: string,
  normalizedAddress: string,
  apiKey: string
): Promise<IntersectionCoordinates | null> {
  console.log(`Geocoding intersection: "${address}"`);

  // Split the intersection into two streets
  const streets = normalizedAddress.split(" & ").map((s) => s.trim());
  if (streets.length !== 2) {
    console.error(
      `Invalid intersection format: expected 2 streets, got ${streets.length}`
    );
    return null;
  }

  // Try Directions API first
  const directionsResult = await geocodeIntersectionViaDirections(
    [streets[0], streets[1]],
    apiKey
  );
  if (directionsResult) {
    return directionsResult;
  }

  console.log(
    `Directions API failed for intersection, falling back to geocoding`
  );

  // Fallback: try geocoding the intersection directly
  console.log(`Trying geocoding with: "${normalizedAddress}"`);
  return await geocodeViaGeocodingAPI(normalizedAddress, apiKey);
}

// Helper function to geocode an address or intersection
async function geocodeAddressOrIntersection(
  address: string
): Promise<IntersectionCoordinates | null> {
  const normalizedAddress = normalizeAddress(address);

  // Check cache first
  if (geocodingCache.has(normalizedAddress)) {
    const cached = geocodingCache.get(normalizedAddress);
    console.log(`Using cached coordinates for "${address}":`, cached);
    return cached || null;
  }

  try {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.error("Google Maps API key is not configured");
      geocodingCache.set(normalizedAddress, null);
      return null;
    }

    let coordinates: IntersectionCoordinates | null = null;

    // Check if this is an intersection (contains &)
    if (normalizedAddress.includes(" & ")) {
      coordinates = await geocodeIntersection(
        address,
        normalizedAddress,
        apiKey
      );
    } else {
      // Regular address geocoding (not an intersection)
      coordinates = await geocodeViaGeocodingAPI(normalizedAddress, apiKey);
    }

    if (!coordinates) {
      console.error(`Failed to geocode "${address}"`);
    }

    // Cache the result (even if null)
    geocodingCache.set(normalizedAddress, coordinates);
    return coordinates;
  } catch (error) {
    console.error("Error geocoding address/intersection:", error);
    geocodingCache.set(normalizedAddress, null);
    return null;
  }
}

// Legacy function kept for backwards compatibility
async function resolveIntersection(
  street: string,
  crossStreet: string
): Promise<IntersectionCoordinates | null> {
  const intersectionKey = `${street} and ${crossStreet}, Sofia, Bulgaria`;
  const normalizedKey = normalizeAddress(intersectionKey);

  // Check cache first
  if (intersectionCache.has(normalizedKey)) {
    return intersectionCache.get(normalizedKey) || null;
  }

  try {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    const encodedAddress = encodeURIComponent(normalizedKey);
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${apiKey}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status === "OK" && data.results && data.results.length > 0) {
      // Prefer results inside Sofia municipality
      let result = data.results[0];
      for (const res of data.results) {
        const addressComponents = res.address_components || [];
        const hasSofia = addressComponents.some(
          (comp: any) =>
            (comp.types.includes("locality") ||
              comp.types.includes("administrative_area_level_1")) &&
            comp.long_name.toLowerCase().includes("sofia")
        );
        if (hasSofia) {
          result = res;
          break;
        }
      }

      const coordinates = {
        lat: result.geometry.location.lat,
        lng: result.geometry.location.lng,
      };

      // Cache the result
      intersectionCache.set(normalizedKey, coordinates);

      return coordinates;
    }

    // Retry with simplified string
    const simplifiedKey = `${street}, ${crossStreet}, Sofia, Bulgaria`;
    const encodedSimplified = encodeURIComponent(simplifiedKey);
    const urlSimplified = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedSimplified}&key=${apiKey}`;

    const responseSimplified = await fetch(urlSimplified);
    const dataSimplified = await responseSimplified.json();

    if (
      dataSimplified.status === "OK" &&
      dataSimplified.results &&
      dataSimplified.results.length > 0
    ) {
      const coordinates = {
        lat: dataSimplified.results[0].geometry.location.lat,
        lng: dataSimplified.results[0].geometry.location.lng,
      };

      intersectionCache.set(normalizedKey, coordinates);
      return coordinates;
    }

    // Cache null result
    intersectionCache.set(normalizedKey, null);
    return null;
  } catch (error) {
    console.error("Error resolving intersection:", error);
    return null;
  }
}

// Step 4 — Street Centerline Retrieval
async function getStreetCenterline(
  startCoords: IntersectionCoordinates,
  endCoords: IntersectionCoordinates
): Promise<GeoJSONLineString | null> {
  try {
    // Check if start and end are the same or very close
    const distance = Math.sqrt(
      Math.pow(endCoords.lat - startCoords.lat, 2) +
        Math.pow(endCoords.lng - startCoords.lng, 2)
    );

    // If points are within ~10 meters (roughly 0.0001 degrees), create a simple line
    if (distance < 0.0001) {
      console.log("Start and end points are very close, creating simple point");
      // For a single point, we'll create a small line segment to allow buffering
      // Extend slightly in a default direction (e.g., 10 meters north-south)
      const offsetDegrees = 0.00009; // approximately 10 meters
      return {
        type: "LineString",
        coordinates: [
          [startCoords.lng, startCoords.lat - offsetDegrees / 2],
          [startCoords.lng, startCoords.lat + offsetDegrees / 2],
        ],
      };
    }

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    const origin = `${startCoords.lat},${startCoords.lng}`;
    const destination = `${endCoords.lat},${endCoords.lng}`;
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&mode=driving&key=${apiKey}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status === "OK" && data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      const polyline = route.overview_polyline?.polyline;

      if (polyline) {
        const coordinates = decodePolyline(polyline);
        return {
          type: "LineString",
          coordinates,
        };
      } else {
        console.error("No polyline found in route response");
        // Fall back to simple straight line
        return {
          type: "LineString",
          coordinates: [
            [startCoords.lng, startCoords.lat],
            [endCoords.lng, endCoords.lat],
          ],
        };
      }
    }

    // Provide more detailed error information
    if (data.status === "OK" && (!data.routes || data.routes.length === 0)) {
      console.error(
        "API returned OK but no routes found, using fallback straight line"
      );
      // Fall back to simple straight line
      return {
        type: "LineString",
        coordinates: [
          [startCoords.lng, startCoords.lat],
          [endCoords.lng, endCoords.lat],
        ],
      };
    } else {
      console.error(
        "Failed to retrieve centerline. API status:",
        data.status,
        "Error message:",
        data.error_message || "None"
      );
      // Fall back to simple straight line
      return {
        type: "LineString",
        coordinates: [
          [startCoords.lng, startCoords.lat],
          [endCoords.lng, endCoords.lat],
        ],
      };
    }
  } catch (error) {
    console.error("Error getting street centerline:", error);
    // Fall back to simple straight line
    return {
      type: "LineString",
      coordinates: [
        [startCoords.lng, startCoords.lat],
        [endCoords.lng, endCoords.lat],
      ],
    };
  }
}

// Decode Google polyline format to coordinates
function decodePolyline(encoded: string): [number, number][] {
  const coordinates: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let b;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    coordinates.push([lng / 1e5, lat / 1e5]);
  }

  return coordinates;
}

// Step 5 — Line-to-Polygon Conversion
function bufferLineString(
  lineString: GeoJSONLineString,
  bufferMeters: number = 8
): GeoJSONPolygon | null {
  const coordinates = lineString.coordinates;
  if (coordinates.length < 2) return null;

  // Convert buffer distance from meters to degrees (approximate)
  // 1 degree of latitude ≈ 111,000 meters
  // At Sofia's latitude (~42.7°), 1 degree of longitude ≈ 82,000 meters
  const bufferDegreesLat = bufferMeters / 111000;
  const bufferDegreesLon = bufferMeters / 82000;

  const leftSide: [number, number][] = [];
  const rightSide: [number, number][] = [];

  for (let i = 0; i < coordinates.length; i++) {
    const [lon, lat] = coordinates[i];

    let perpLon = 0;
    let perpLat = 1;

    if (i < coordinates.length - 1) {
      // Calculate perpendicular direction
      const [nextLon, nextLat] = coordinates[i + 1];
      const dLon = nextLon - lon;
      const dLat = nextLat - lat;
      const length = Math.sqrt(dLon * dLon + dLat * dLat);

      if (length > 0) {
        // Perpendicular vector (rotated 90 degrees)
        perpLon = -dLat / length;
        perpLat = dLon / length;
      }
    } else if (i > 0) {
      // Use previous segment's direction for last point
      const [prevLon, prevLat] = coordinates[i - 1];
      const dLon = lon - prevLon;
      const dLat = lat - prevLat;
      const length = Math.sqrt(dLon * dLon + dLat * dLat);

      if (length > 0) {
        perpLon = -dLat / length;
        perpLat = dLon / length;
      }
    }

    // Apply buffer with proper longitude/latitude scaling
    leftSide.push([
      lon + perpLon * bufferDegreesLon,
      lat + perpLat * bufferDegreesLat,
    ]);
    rightSide.push([
      lon - perpLon * bufferDegreesLon,
      lat - perpLat * bufferDegreesLat,
    ]);
  }

  // Create polygon by combining left side, reversed right side, and closing
  const polygonRing: [number, number][] = [
    ...leftSide,
    ...rightSide.reverse(),
    leftSide[0], // Close the polygon
  ];

  return {
    type: "Polygon",
    coordinates: [polygonRing],
  };
}

// Determine buffer width based on street type
function getBufferWidth(streetName: string): number {
  const lowerStreet = streetName.toLowerCase();

  if (lowerStreet.includes("boulevard") || lowerStreet.includes("булевард")) {
    return 13; // 12-14m average
  } else if (
    lowerStreet.includes("avenue") ||
    lowerStreet.includes("проспект") ||
    lowerStreet.includes("collector")
  ) {
    return 9; // 8-10m average
  } else {
    return 7; // 6-8m average for residential
  }
}

// Step 6 — Closure Feature Assembly
async function createClosureFeature(
  street: StreetSection,
  timespan: { start: string; end: string }[]
): Promise<GeoJSONFeature | null> {
  try {
    // Step 3: Resolve endpoints
    // The from/to fields now contain either intersections (e.g., "Street A & Street B")
    // or specific addresses (e.g., "Street A №12")
    const startCoords = await geocodeAddressOrIntersection(street.from);
    const endCoords = await geocodeAddressOrIntersection(street.to);

    if (!startCoords || !endCoords) {
      console.error("Failed to resolve endpoints for:", street);
      // Return null instead of invalid geometry
      return null;
    }

    // Add small delay to respect API quotas
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Step 4: Get centerline
    const centerline = await getStreetCenterline(startCoords, endCoords);

    if (!centerline) {
      console.error("Failed to retrieve centerline for:", street);
      // Return null instead of invalid geometry
      return null;
    }

    // Step 5: Convert to polygon
    const bufferWidth = getBufferWidth(street.street);
    const polygon = bufferLineString(centerline, bufferWidth);

    if (!polygon) {
      console.error("Failed to buffer linestring for:", street);
      return null;
    }

    // Step 6: Assemble feature
    return {
      type: "Feature",
      geometry: polygon,
      properties: {
        feature_type: "street_closure",
        street: street.street,
        from: street.from,
        to: street.to,
        start_time: timespan[0]?.start || "",
        end_time: timespan[0]?.end || "",
      },
    };
  } catch (error) {
    console.error("Error creating closure feature:", error);
    return null;
  }
}

// Step 7 — Feature Collection Assembly
export async function convertToGeoJSON(
  extractedData: ExtractedData,
  preGeocodedAddresses?: Map<string, IntersectionCoordinates>
): Promise<GeoJSONFeatureCollection> {
  const features: GeoJSONFeature[] = [];

  // Process all pins
  console.log("Processing pins:", extractedData.pins.length);
  for (const pin of extractedData.pins) {
    const feature = await geocodePin(pin, preGeocodedAddresses);
    if (feature) {
      features.push(feature);
    }
    // Add delay only if we're actually geocoding (not using pre-geocoded data)
    if (!preGeocodedAddresses?.has(pin)) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  // Process all street closures
  console.log("Processing street closures:", extractedData.streets.length);
  for (const street of extractedData.streets) {
    const feature = await createClosureFeature(street, extractedData.timespan);
    if (feature) {
      features.push(feature);
    }
    // Add delay to respect API quotas
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  console.log("Total features created:", features.length);

  return {
    type: "FeatureCollection",
    features,
  };
}

// Export cache clearing function for testing
export function clearCaches(): void {
  geocodingCache.clear();
  intersectionCache.clear();
}
