import {
  geocodeAddresses,
  geocodeIntersectionsForStreets,
} from "@/lib/geocoding-router";
import { Address, ExtractedData, StreetSection } from "@/lib/types";
import { STREET_GEOCODING_ALGO, PIN_GEOCODING_ALGO } from "@/lib/config";

// Internal types for the geocoding pipeline
export interface GeocodingResult {
  preGeocodedMap: Map<string, { lat: number; lng: number }>;
  addresses: Address[];
}

/**
 * Helper: Find missing street endpoints that haven't been geocoded
 * Exported for unit testing
 */
export function findMissingStreetEndpoints(
  streets: StreetSection[],
  geocodedMap: Map<string, { lat: number; lng: number }>
): string[] {
  const missing: string[] = [];

  streets.forEach((street) => {
    if (!geocodedMap.has(street.from)) {
      missing.push(street.from);
    }
    if (!geocodedMap.has(street.to)) {
      missing.push(street.to);
    }
  });

  return missing;
}

/**
 * Helper: Collect all unique addresses from extracted data
 * Exported for unit testing
 */
export function collectAllAddressesFromExtractedData(
  extractedData: ExtractedData
): Set<string> {
  const addressesToGeocode = new Set<string>();

  // Add pin addresses
  extractedData.pins.forEach((pin) => {
    addressesToGeocode.add(pin.address);
  });

  // Add street endpoint addresses
  extractedData.streets.forEach((street) => {
    addressesToGeocode.add(street.from);
    addressesToGeocode.add(street.to);
  });

  return addressesToGeocode;
}

/**
 * Step 4: Geocode addresses from extracted data
 * Pure function that converts addresses to coordinates
 */
export async function geocodeAddressesFromExtractedData(
  extractedData: ExtractedData | null
): Promise<GeocodingResult> {
  const preGeocodedMap = new Map<string, { lat: number; lng: number }>();
  let addresses: Address[] = [];

  if (!extractedData) {
    return { preGeocodedMap, addresses };
  }

  if (
    STREET_GEOCODING_ALGO === "google_directions" ||
    STREET_GEOCODING_ALGO === "overpass"
  ) {
    // Directions/Overpass-based approach: handle pins and streets separately
    console.log(`Geocoding pins using: ${PIN_GEOCODING_ALGO}`);

    // Geocode pins
    if (extractedData.pins.length > 0) {
      const pinAddresses = extractedData.pins.map((pin) => pin.address);
      const geocodedPins = await geocodeAddresses(pinAddresses);
      addresses.push(...geocodedPins);

      geocodedPins.forEach((addr) => {
        preGeocodedMap.set(addr.originalText, addr.coordinates);
      });
    }

    // Geocode street intersections
    console.log(`Geocoding streets using: ${STREET_GEOCODING_ALGO}`);
    if (extractedData.streets.length > 0) {
      const streetGeocodedMap = await geocodeIntersectionsForStreets(
        extractedData.streets
      );

      // Merge into preGeocodedMap
      streetGeocodedMap.forEach((coords, key) => {
        preGeocodedMap.set(key, coords);
      });

      // Check for missing endpoints and try fallback geocoding
      const missingEndpoints = findMissingStreetEndpoints(
        extractedData.streets,
        preGeocodedMap
      );

      if (missingEndpoints.length > 0) {
        console.log(
          `⚠️  ${missingEndpoints.length} street endpoints not found via ${STREET_GEOCODING_ALGO}, trying fallback geocoding...`
        );
        const fallbackGeocoded = await geocodeAddresses(missingEndpoints);

        fallbackGeocoded.forEach((addr) => {
          preGeocodedMap.set(addr.originalText, addr.coordinates);
          console.log(
            `   ✅ Fallback geocoded: "${addr.originalText}" → [${addr.coordinates.lat}, ${addr.coordinates.lng}]`
          );
        });
      }
    }
  } else {
    // Traditional approach: collect all addresses and geocode in one batch
    const addressesToGeocode =
      collectAllAddressesFromExtractedData(extractedData);

    console.log(
      `Collected ${addressesToGeocode.size} unique addresses to geocode`
    );

    addresses = await geocodeAddresses(Array.from(addressesToGeocode));

    console.log(
      `Successfully geocoded ${addresses.length}/${addressesToGeocode.size} addresses`
    );

    addresses.forEach((addr) => {
      preGeocodedMap.set(addr.originalText, addr.coordinates);
    });
  }

  return { preGeocodedMap, addresses };
}
