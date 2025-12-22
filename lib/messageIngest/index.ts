import {
  Address,
  ExtractedData,
  GeoJSONFeatureCollection,
  Message,
} from "../types";
import {
  storeIncomingMessage,
  storeAddressesInMessage,
  storeGeocodingInMessage,
  storeGeoJsonInMessage,
} from "./db";

export { extractAddressesFromMessage } from "./extract-addresses";
export {
  geocodeAddressesFromExtractedData,
  type GeocodingResult,
} from "./geocode-addresses";
export { convertMessageGeocodingToGeoJson } from "./convert-to-geojson";
export { verifyAuthToken, validateMessageText } from "./helpers";
export { buildMessageResponse } from "./build-response";

export interface MessageIngestOptions {
  /**
   * Provide ready GeoJSON geometry to skip AI extraction + geocoding.
   * Used by crawlers or integrations with pre-geocoded data.
   */
  precomputedGeoJson?: GeoJSONFeatureCollection | null;
  /**
   * Optional source URL for the message (e.g., original article URL)
   */
  sourceUrl?: string;
  /**
   * Optional boundary filtering - if provided, only features within boundaries are kept
   * If no features are within boundaries, the message is not stored
   */
  boundaryFilter?: GeoJSONFeatureCollection;
}

/**
 * Execute the full message ingest pipeline
 * @param text - The message text to process
 * @param source - The source of the message (e.g., 'web-interface', 'api', etc.)
 * @param userId - The ID of the user creating the message
 * @param userEmail - The email of the user creating the message (can be null)
 * @returns The processed message with geocoding and GeoJSON data
 */
export async function messageIngest(
  text: string,
  source: string,
  userId: string,
  userEmail: string | null,
  options: MessageIngestOptions = {}
): Promise<Message> {
  // Step 1: Store incoming message
  const messageId = await storeIncomingMessage(
    text,
    userId,
    userEmail,
    source,
    options.sourceUrl
  );

  const hasPrecomputedGeoJson = Boolean(options.precomputedGeoJson);
  let extractedData: ExtractedData | null = null;
  let addresses: Address[] = [];
  let geoJson: GeoJSONFeatureCollection | null =
    options.precomputedGeoJson ?? null;

  if (!hasPrecomputedGeoJson) {
    // Step 2: Extract addresses from message
    const { extractAddressesFromMessage } = await import("./extract-addresses");
    extractedData = await extractAddressesFromMessage(text);

    // Step 3: Store extracted addresses in message
    await storeAddressesInMessage(messageId, extractedData);

    // Step 4: Geocode addresses
    const { geocodeAddressesFromExtractedData } = await import(
      "./geocode-addresses"
    );
    const { preGeocodedMap, addresses: geocodedAddresses } =
      await geocodeAddressesFromExtractedData(extractedData);
    addresses = geocodedAddresses;

    // Step 5: Store geocoding results in message
    await storeGeocodingInMessage(messageId, addresses);

    // Step 6: Convert to GeoJSON
    const { convertMessageGeocodingToGeoJson } = await import(
      "./convert-to-geojson"
    );
    geoJson = await convertMessageGeocodingToGeoJson(
      extractedData,
      preGeocodedMap
    );
  }

  // Step 6.5: Apply boundary filtering if provided
  if (options.boundaryFilter && geoJson) {
    const { filterFeaturesByBoundaries } = await import("../boundary-utils");
    const filteredGeoJson = filterFeaturesByBoundaries(
      geoJson,
      options.boundaryFilter
    );

    if (!filteredGeoJson) {
      // No features within boundaries, don't store the message
      console.log(
        `⏭️  Message ${messageId} has no features within boundaries, skipping storage`
      );
      // Note: The message document already exists in Firestore from storeIncomingMessage
      // We could delete it here, but leaving it allows for auditing
      throw new Error("No features within specified boundaries");
    }

    geoJson = filteredGeoJson;
  }

  // Step 7: Store GeoJSON in message (either generated or provided)
  await storeGeoJsonInMessage(messageId, geoJson);

  // Build and return response
  const { buildMessageResponse } = await import("./build-response");
  const newMessage = await buildMessageResponse(
    messageId,
    text,
    addresses,
    extractedData,
    geoJson
  );

  return newMessage;
}
