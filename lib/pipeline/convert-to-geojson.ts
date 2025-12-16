import { convertToGeoJSON } from "@/lib/geojson-service";
import { ExtractedData, GeoJSONFeatureCollection } from "@/lib/types";

/**
 * Helper: Validate that all addresses have been geocoded
 * Exported for unit testing
 */
export function validateAllAddressesGeocoded(
  extractedData: ExtractedData,
  preGeocodedMap: Map<string, { lat: number; lng: number }>
): string[] {
  const missingAddresses: string[] = [];

  extractedData.pins.forEach((pin) => {
    if (!preGeocodedMap.has(pin.address)) {
      missingAddresses.push(pin.address);
    }
  });

  extractedData.streets.forEach((street) => {
    if (!preGeocodedMap.has(street.from)) {
      missingAddresses.push(`${street.street} from: ${street.from}`);
    }
    if (!preGeocodedMap.has(street.to)) {
      missingAddresses.push(`${street.street} to: ${street.to}`);
    }
  });

  return missingAddresses;
}

/**
 * Step 6: Convert geocoded data to GeoJSON
 * Pure function that creates GeoJSON from extracted data and coordinates
 */
export async function convertMessageGeocodingToGeoJson(
  extractedData: ExtractedData | null,
  preGeocodedMap: Map<string, { lat: number; lng: number }>
): Promise<GeoJSONFeatureCollection | null> {
  if (!extractedData) {
    return null;
  }

  // Validate that all required addresses have been geocoded
  const missingAddresses = validateAllAddressesGeocoded(
    extractedData,
    preGeocodedMap
  );

  if (missingAddresses.length > 0) {
    console.error(
      `Missing geocoded coordinates for ${missingAddresses.length} addresses:`,
      missingAddresses
    );
    throw new Error(
      `Failed to geocode ${
        missingAddresses.length
      } addresses: ${missingAddresses.join(", ")}`
    );
  }

  const geoJson = await convertToGeoJSON(extractedData, preGeocodedMap);
  console.log(`Generated GeoJSON with ${geoJson.features.length} features`);

  return geoJson;
}
