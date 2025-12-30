import {
  Address,
  ExtractedData,
  GeoJSONFeatureCollection,
  Message,
} from "@/lib/types";
import { storeIncomingMessage, updateMessage } from "./db";

export { extractAddressesFromMessage } from "./extract-addresses";
export {
  geocodeAddressesFromExtractedData,
  type GeocodingResult,
} from "./geocode-addresses";
export { convertMessageGeocodingToGeoJson } from "./convert-to-geojson";
export { filterOutlierCoordinates } from "./filter-outliers";
export { verifyAuthToken, validateMessageText } from "./helpers";
export { buildMessageResponse } from "./build-response";
export { filterAndNormalizeMessage } from "./filter-message";

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
  /**
   * Optional crawledAt timestamp from the source document
   */
  crawledAt?: Date;
  /**
   * Optional markdown-formatted text for display (when crawler produces markdown)
   */
  markdownText?: string;
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
  // Store incoming message
  const messageId = await storeIncomingMessage(
    text,
    userId,
    userEmail,
    source,
    options.sourceUrl,
    options.crawledAt
  );

  const hasPrecomputedGeoJson = Boolean(options.precomputedGeoJson);
  let extractedData: ExtractedData | null = null;
  let addresses: Address[] = [];
  let geoJson: GeoJSONFeatureCollection | null =
    options.precomputedGeoJson ?? null;
  let normalizedText = text;

  if (!hasPrecomputedGeoJson) {
    // Filter message to check relevance and normalize text
    const { filterAndNormalizeMessage } = await import("./filter-message");
    const filterResult = await filterAndNormalizeMessage(text);

    if (!filterResult) {
      console.error("❌ Failed to filter message, marking as finalized");
      await updateMessage(messageId, { finalizedAt: new Date() });
      throw new Error("Message filtering failed");
    }

    // Store filter result
    await updateMessage(messageId, {
      messageFilter: filterResult,
    });

    // If message is not relevant to public infrastructure, finalize and return
    if (!filterResult.isRelevant) {
      console.log(
        "ℹ️  Message filtered as irrelevant (transport-only), marking as finalized"
      );
      await updateMessage(messageId, { finalizedAt: new Date() });

      const { buildMessageResponse } = await import("./build-response");
      return await buildMessageResponse(messageId, text, [], null, null);
    }

    // Use normalized text for extraction
    normalizedText = filterResult.normalizedText || text;

    // Extract structured data from normalized text
    const { extractAddressesFromMessage } = await import("./extract-addresses");
    extractedData = await extractAddressesFromMessage(normalizedText);

    // Store extracted data and markdown text together
    const markdownText = extractedData?.markdown_text || "";
    await updateMessage(messageId, {
      extractedData,
      markdownText,
    });

    // If extraction failed, finalize and return
    if (!extractedData) {
      console.error(
        "❌ Failed to extract data from message, marking as finalized"
      );
      await updateMessage(messageId, { finalizedAt: new Date() });

      const { buildMessageResponse } = await import("./build-response");
      return await buildMessageResponse(messageId, text, [], null, null);
    }

    // Geocode addresses
    const { geocodeAddressesFromExtractedData } = await import(
      "./geocode-addresses"
    );
    const { preGeocodedMap, addresses: geocodedAddresses } =
      await geocodeAddressesFromExtractedData(extractedData);

    // Filter outlier coordinates
    const { filterOutlierCoordinates } = await import("./filter-outliers");
    addresses = filterOutlierCoordinates(geocodedAddresses);

    // Update preGeocodedMap to remove filtered outliers
    const filteredOriginalTexts = new Set(addresses.map((a) => a.originalText));
    for (const [key] of preGeocodedMap) {
      if (!filteredOriginalTexts.has(key)) {
        preGeocodedMap.delete(key);
      }
    }

    // Store geocoding results in message
    if (addresses.length > 0) {
      await updateMessage(messageId, { addresses });
    }

    // Convert to GeoJSON
    const { convertMessageGeocodingToGeoJson } = await import(
      "./convert-to-geojson"
    );
    geoJson = await convertMessageGeocodingToGeoJson(
      extractedData,
      preGeocodedMap
    );
  } else if (options.markdownText) {
    // When using precomputed GeoJSON, store markdown_text if provided
    extractedData = {
      responsible_entity: "",
      pins: [],
      streets: [],
      markdown_text: options.markdownText,
    };
    await updateMessage(messageId, {
      markdownText: options.markdownText,
      extractedData,
    });
  }

  // Apply boundary filtering if provided
  if (options.boundaryFilter && geoJson) {
    const { filterFeaturesByBoundaries } = await import(
      "../lib/boundary-utils"
    );
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

  // Store GeoJSON and finalize message
  if (geoJson) {
    await updateMessage(messageId, { geoJson, finalizedAt: new Date() });
  }

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
