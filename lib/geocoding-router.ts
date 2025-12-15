/**
 * Unified geocoding interface
 * Routes to the appropriate geocoding service based on configuration
 */

import { GEOCODING_ALGO } from "./config";
import { Address, StreetSection } from "./types";
import { geocodeAddresses as geocodeAddressesTraditional } from "./geocoding-service";
import {
  geocodeIntersections,
  geocodeStreetSections,
  geocodeAddress as geocodeAddressDirections,
} from "./directions-geocoding-service";
import {
  mapboxGeocodeAddresses,
  mapboxGeocodeIntersections,
} from "./mapbox-geocoding-service";
import {
  overpassGeocodeAddresses,
  overpassGeocodeIntersections,
} from "./overpass-geocoding-service";

/**
 * Geocode a list of addresses using the configured algorithm
 */
export async function geocodeAddresses(
  addresses: string[]
): Promise<Address[]> {
  if (GEOCODING_ALGO === "overpass") {
    // Use OSM Overpass API + Turf.js for all geocoding
    return overpassGeocodeAddresses(addresses);
  } else if (GEOCODING_ALGO === "mapbox_geocoding") {
    // Use Mapbox for all geocoding
    return mapboxGeocodeAddresses(addresses);
  } else if (GEOCODING_ALGO === "google_directions") {
    // For directions mode, we need to handle addresses differently
    // For now, use the traditional method for simple addresses
    const results: Address[] = [];

    for (const addr of addresses) {
      const geocoded = await geocodeAddressDirections(addr);
      if (geocoded) {
        results.push(geocoded);
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    return results;
  } else {
    return geocodeAddressesTraditional(addresses);
  }
}

/**
 * Geocode street sections using the configured algorithm
 */
export async function geocodeStreets(
  streets: StreetSection[]
): Promise<Address[]> {
  if (GEOCODING_ALGO === "overpass") {
    // For Overpass-based, geocode endpoints
    const endpointAddresses = streets.flatMap((s) => [s.from, s.to]);
    return overpassGeocodeAddresses(endpointAddresses);
  } else if (GEOCODING_ALGO === "mapbox_geocoding") {
    // For Mapbox, geocode endpoints
    const endpointAddresses = streets.flatMap((s) => [s.from, s.to]);
    return mapboxGeocodeAddresses(endpointAddresses);
  } else if (GEOCODING_ALGO === "google_directions") {
    // Use directions-based approach for street sections
    const sections: [string, string, string][] = streets.map((s) => [
      s.street,
      s.from,
      s.to,
    ]);

    return geocodeStreetSections(sections, 10); // 10m buffer
  } else {
    // Traditional approach: geocode endpoints
    const endpointAddresses = streets.flatMap((s) => [s.from, s.to]);
    return geocodeAddresses(endpointAddresses);
  }
}

/**
 * Geocode street section intersections using the configured algorithm
 */
export async function geocodeIntersectionsForStreets(
  streets: StreetSection[]
): Promise<Map<string, { lat: number; lng: number }>> {
  const geocodedMap = new Map<string, { lat: number; lng: number }>();

  if (GEOCODING_ALGO === "overpass") {
    // Extract unique intersections
    const intersectionSet = new Set<string>();
    const intersections: string[] = [];

    streets.forEach((street) => {
      const fromIntersection = `${street.street} ∩ ${street.from}`;
      if (!intersectionSet.has(fromIntersection)) {
        intersectionSet.add(fromIntersection);
        intersections.push(fromIntersection);
      }

      const toIntersection = `${street.street} ∩ ${street.to}`;
      if (!intersectionSet.has(toIntersection)) {
        intersectionSet.add(toIntersection);
        intersections.push(toIntersection);
      }
    });

    console.log(
      `Geocoding ${intersections.length} unique intersections using Overpass API + Turf.js`
    );

    const geocoded = await overpassGeocodeIntersections(intersections);

    geocoded.forEach((address) => {
      // Store with the full intersection key (for completeness)
      geocodedMap.set(address.formattedAddress, address.coordinates);
      console.log(
        `   📍 Stored: "${address.formattedAddress}" → [${address.coordinates.lat}, ${address.coordinates.lng}]`
      );

      // ALSO store with just the cross street name (what GeoJSON service expects)
      // Extract the cross street from "ул. A ∩ ул. B" format
      const parts = address.formattedAddress.split(" ∩ ");
      if (parts.length === 2) {
        const crossStreet = parts[1].trim();
        geocodedMap.set(crossStreet, address.coordinates);
        console.log(
          `   📍 Also stored: "${crossStreet}" → [${address.coordinates.lat}, ${address.coordinates.lng}]`
        );
      }
    });
  } else if (GEOCODING_ALGO === "mapbox_geocoding") {
    // Extract unique intersections
    const intersectionSet = new Set<string>();
    const intersectionPairs: [string, string, string][] = [];

    streets.forEach((street) => {
      const fromKey = `${street.street}||${street.from}`;
      if (!intersectionSet.has(fromKey)) {
        intersectionSet.add(fromKey);
        intersectionPairs.push([street.street, street.from, street.from]);
      }

      const toKey = `${street.street}||${street.to}`;
      if (!intersectionSet.has(toKey)) {
        intersectionSet.add(toKey);
        intersectionPairs.push([street.street, street.to, street.to]);
      }
    });

    console.log(
      `Geocoding ${intersectionPairs.length} unique intersections using Mapbox`
    );

    const pairsForGeocoding: [string, string][] = intersectionPairs.map(
      ([street, cross]) => [street, cross]
    );
    const geocoded = await mapboxGeocodeIntersections(pairsForGeocoding);

    geocoded.forEach((coords, key) => {
      geocodedMap.set(key, coords);
    });
  } else if (GEOCODING_ALGO === "google_directions") {
    // Extract unique intersections (street + cross street pairs)
    const intersectionSet = new Set<string>();
    const intersectionPairs: [string, string, string][] = []; // [street, crossStreet, crossStreetKey]

    streets.forEach((street) => {
      // From intersection: street ∩ from
      const fromKey = `${street.street}||${street.from}`;
      if (!intersectionSet.has(fromKey)) {
        intersectionSet.add(fromKey);
        intersectionPairs.push([street.street, street.from, street.from]);
      }

      // To intersection: street ∩ to
      const toKey = `${street.street}||${street.to}`;
      if (!intersectionSet.has(toKey)) {
        intersectionSet.add(toKey);
        intersectionPairs.push([street.street, street.to, street.to]);
      }
    });

    console.log(
      `Geocoding ${intersectionPairs.length} unique intersections using Directions API`
    );

    // Geocode each intersection
    const pairsForGeocoding: [string, string][] = intersectionPairs.map(
      ([street, cross]) => [street, cross]
    );
    const geocoded = await geocodeIntersections(pairsForGeocoding);

    // Map results - the key should be the cross street name (from/to value)
    // because that's what the GeoJSON service uses for lookup
    intersectionPairs.forEach(([, , crossStreetKey], index) => {
      if (geocoded[index]) {
        geocodedMap.set(crossStreetKey, geocoded[index].coordinates);
      }
    });
  } else {
    // Traditional approach: geocode combined addresses
    const addresses = streets.flatMap((s) => [s.from, s.to]);
    const uniqueAddresses = Array.from(new Set(addresses));
    const geocoded = await geocodeAddresses(uniqueAddresses);

    geocoded.forEach((addr) => {
      geocodedMap.set(addr.originalText, addr.coordinates);
    });
  }

  return geocodedMap;
}
