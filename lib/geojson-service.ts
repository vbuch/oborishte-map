import {
  ExtractedData,
  StreetSection,
  GeoJSONFeatureCollection,
  GeoJSONFeature,
  GeoJSONLineString,
  GeoJSONPolygon,
  IntersectionCoordinates,
} from "./types";
import { getStreetGeometry } from "./geocoding-router";

// Constants for street buffer widths (in meters)
const BUFFER_WIDTH_BOULEVARD = 13; // 12-14m average
const BUFFER_WIDTH_AVENUE = 9; // 8-10m average
const BUFFER_WIDTH_RESIDENTIAL = 7; // 6-8m average

// Step 1 — PIN / Address Geocoding (Points)
function createPinFeature(
  pin: { address: string; timespans: { start: string; end: string }[] },
  preGeocodedAddresses: Map<string, IntersectionCoordinates>
): GeoJSONFeature {
  const coords = preGeocodedAddresses.get(pin.address);

  if (!coords) {
    throw new Error(
      `Missing pre-geocoded coordinates for pin: "${pin.address}"`
    );
  }

  return {
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: [coords.lng, coords.lat],
    },
    properties: {
      feature_type: "pin",
      address: pin.address,
      start_time: pin.timespans[0]?.start || "",
      end_time: pin.timespans[0]?.end || "",
    },
  };
}

// Step 2 — Street Centerline Retrieval
async function getStreetCenterline(
  startCoords: IntersectionCoordinates,
  endCoords: IntersectionCoordinates,
  streetName: string
): Promise<GeoJSONLineString> {
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

  // Use the configured geocoding algorithm via the router
  console.log(`   Getting street geometry for: ${streetName}`);
  const geometry = await getStreetGeometry(streetName, startCoords, endCoords);

  if (geometry && geometry.length >= 2) {
    console.log(`   ✅ Retrieved geometry with ${geometry.length} points`);
    return {
      type: "LineString",
      coordinates: geometry,
    };
  }

  // Fallback to straight line between the two points
  console.log(`   ⚠️  Using fallback straight line`);
  return {
    type: "LineString",
    coordinates: [
      [startCoords.lng, startCoords.lat],
      [endCoords.lng, endCoords.lat],
    ],
  };
}

// Step 3 — Line-to-Polygon Conversion
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
    return BUFFER_WIDTH_BOULEVARD;
  } else if (
    lowerStreet.includes("avenue") ||
    lowerStreet.includes("проспект") ||
    lowerStreet.includes("collector")
  ) {
    return BUFFER_WIDTH_AVENUE;
  } else {
    return BUFFER_WIDTH_RESIDENTIAL;
  }
}

// Step 4 — Closure Feature Assembly
async function createClosureFeature(
  street: StreetSection,
  preGeocodedAddresses: Map<string, IntersectionCoordinates>
): Promise<GeoJSONFeature> {
  // Get pre-geocoded coordinates
  const startCoords = preGeocodedAddresses.get(street.from);
  const endCoords = preGeocodedAddresses.get(street.to);

  if (!startCoords) {
    throw new Error(
      `Missing pre-geocoded coordinates for street start: "${street.from}"`
    );
  }

  if (!endCoords) {
    throw new Error(
      `Missing pre-geocoded coordinates for street end: "${street.to}"`
    );
  }

  console.log(
    `Creating street closure: ${street.street} from "${street.from}" to "${street.to}"`
  );

  // Get centerline
  const centerline = await getStreetCenterline(
    startCoords,
    endCoords,
    street.street
  );

  // Convert to polygon
  const bufferWidth = getBufferWidth(street.street);
  const polygon = bufferLineString(centerline, bufferWidth);

  if (!polygon) {
    throw new Error(`Failed to buffer linestring for: ${street.street}`);
  }

  // Assemble feature
  return {
    type: "Feature",
    geometry: polygon,
    properties: {
      feature_type: "street_closure",
      street: street.street,
      from: street.from,
      to: street.to,
      start_time: street.timespans[0]?.start || "",
      end_time: street.timespans[0]?.end || "",
    },
  };
}

// Step 5 — Feature Collection Assembly
export async function convertToGeoJSON(
  extractedData: ExtractedData,
  preGeocodedAddresses: Map<string, IntersectionCoordinates>
): Promise<GeoJSONFeatureCollection> {
  const features: GeoJSONFeature[] = [];

  // Process all pins
  console.log(`Processing ${extractedData.pins.length} pins...`);
  for (const pin of extractedData.pins) {
    const feature = createPinFeature(pin, preGeocodedAddresses);
    features.push(feature);
  }

  // Process all street closures
  console.log(`Processing ${extractedData.streets.length} street closures...`);
  for (const street of extractedData.streets) {
    const feature = await createClosureFeature(street, preGeocodedAddresses);
    features.push(feature);
  }

  console.log(`✅ Created ${features.length} total features`);

  return {
    type: "FeatureCollection",
    features,
  };
}
