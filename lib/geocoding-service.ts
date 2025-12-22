import { Address } from "./types";
import { isWithinSofia } from "./geocoding-utils";
import { delay } from "./delay";

// Constants for API rate limiting
const GEOCODING_BATCH_DELAY_MS = 200;

interface GeocodeResult {
  formatted_address: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
}

export async function geocodeAddress(address: string): Promise<Address | null> {
  try {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    const encodedAddress = encodeURIComponent(`${address}, Sofia, Bulgaria`);
    // Use components parameter to restrict to Sofia (locality)
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&components=locality:Sofia|country:BG&key=${apiKey}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status === "OK" && data.results && data.results.length > 0) {
      // Try to find a result within Sofia's boundaries
      for (const result of data.results) {
        const lat = result.geometry.location.lat;
        const lng = result.geometry.location.lng;

        // Validate that the result is actually within Sofia
        if (isWithinSofia(lat, lng)) {
          console.log(
            `✅ Geocoded "${address}" within Sofia: [${lat.toFixed(
              6
            )}, ${lng.toFixed(6)}]`
          );
          return {
            originalText: address,
            formattedAddress: result.formatted_address,
            coordinates: { lat, lng },
            geoJson: {
              type: "Point",
              coordinates: [lng, lat],
            },
          };
        } else {
          console.warn(
            `⚠️  Result for "${address}" is outside Sofia: [${lat.toFixed(
              6
            )}, ${lng.toFixed(6)}]`
          );
        }
      }

      // All results were outside Sofia
      console.warn(
        `❌ No results for "${address}" found within Sofia boundaries`
      );
      return null;
    }

    return null;
  } catch (error) {
    console.error("Error geocoding address:", error);
    return null;
  }
}

export async function geocodeAddresses(
  addresses: string[]
): Promise<Address[]> {
  const geocodedAddresses: Address[] = [];

  for (const address of addresses) {
    const geocoded = await geocodeAddress(address);

    if (geocoded) {
      geocodedAddresses.push(geocoded);
    } else {
      console.warn(`Failed to geocode address: ${address}`);
    }
    // Add a small delay to avoid hitting rate limits
    await delay(GEOCODING_BATCH_DELAY_MS);
  }

  return geocodedAddresses;
}
