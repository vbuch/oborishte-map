import { GoogleGenAI } from "@google/genai";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ExtractedData } from "./types";

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY || "" });

// Read the message filter prompt template
let filterSystemInstruction: string;
try {
  filterSystemInstruction = readFileSync(
    join(process.cwd(), "prompts/message-filter.md"),
    "utf-8"
  );
} catch (error) {
  console.error("Failed to load message filter prompt template:", error);
  throw new Error("Message filter prompt template file not found");
}

// Read the data extraction prompt template
// Uses Overpass-optimized prompt for hybrid geocoding (Google for pins, Overpass for streets)
let extractionSystemInstruction: string;
try {
  extractionSystemInstruction = readFileSync(
    join(process.cwd(), "prompts/data-extraction-overpass.md"),
    "utf-8"
  );
} catch (error) {
  console.error("Failed to load data extraction prompt template:", error);
  throw new Error("Data extraction prompt template file not found");
}

export interface FilterResult {
  isRelevant: boolean;
  normalizedText: string;
}

export async function filterMessage(
  text: string
): Promise<FilterResult | null> {
  try {
    // Validate message
    if (!text || typeof text !== "string") {
      console.error("Invalid text parameter for message filtering");
      return null;
    }

    // Validate message length
    if (text.length > 10000) {
      console.error(
        "Text is too long for message filtering (max 10000 characters)"
      );
      return null;
    }

    // Validate required environment variable
    const model = process.env.GOOGLE_AI_MODEL;
    if (!model) {
      console.error("GOOGLE_AI_MODEL environment variable is not set");
      return null;
    }

    // Make request to Gemini API
    const response = await ai.models.generateContent({
      model: model,
      contents: text,
      config: {
        systemInstruction: filterSystemInstruction,
      },
    });
    const responseText = response.text || "";

    // Parse the JSON response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsedResponse = JSON.parse(jsonMatch[0]);

        // Validate response structure
        if (
          typeof parsedResponse.isRelevant !== "boolean" ||
          typeof parsedResponse.normalizedText !== "string"
        ) {
          console.error("Invalid filter response structure:", parsedResponse);
          return null;
        }

        return {
          isRelevant: parsedResponse.isRelevant,
          normalizedText: parsedResponse.normalizedText,
        };
      } catch (parseError) {
        console.error("Failed to parse JSON response from AI:", parseError);
        return null;
      }
    }

    return null;
  } catch (error) {
    console.error("Error filtering message:", error);
    return null;
  }
}

export async function extractStructuredData(
  text: string
): Promise<ExtractedData | null> {
  try {
    // Validate message
    if (!text || typeof text !== "string") {
      console.error("Invalid text parameter for data extraction");
      return null;
    }

    // Validate message length
    if (text.length > 5000) {
      console.error(
        "Text is too long for data extraction (max 5000 characters)"
      );
      return null;
    }

    // Sanitize input to prevent prompt injection
    const sanitizedText = text.replace(/[\n\r]/g, " ").trim();

    // Validate required environment variable
    const model = process.env.GOOGLE_AI_MODEL;
    if (!model) {
      console.error("GOOGLE_AI_MODEL environment variable is not set");
      return null;
    }

    // Make request to Gemini API
    const response = await ai.models.generateContent({
      model: model,
      contents: sanitizedText,
      config: {
        systemInstruction: extractionSystemInstruction,
      },
    });
    const responseText = response.text || "";

    // Parse the JSON response to extract the full structured data
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsedResponse = JSON.parse(jsonMatch[0]);

        // Validate and filter pins array
        const validPins = Array.isArray(parsedResponse.pins)
          ? parsedResponse.pins
              .filter(
                (pin: any) =>
                  pin &&
                  typeof pin === "object" &&
                  typeof pin.address === "string" &&
                  pin.address.trim().length > 0 &&
                  Array.isArray(pin.timespans)
              )
              .map((pin: any) => ({
                address: pin.address,
                timespans: pin.timespans.filter(
                  (time: any) =>
                    time &&
                    typeof time === "object" &&
                    typeof time.start === "string" &&
                    typeof time.end === "string"
                ),
              }))
          : [];

        // Validate and filter streets array
        const validStreets = Array.isArray(parsedResponse.streets)
          ? parsedResponse.streets
              .filter(
                (street: any) =>
                  street &&
                  typeof street === "object" &&
                  typeof street.street === "string" &&
                  typeof street.from === "string" &&
                  typeof street.to === "string" &&
                  Array.isArray(street.timespans)
              )
              .map((street: any) => ({
                street: street.street,
                from: street.from,
                to: street.to,
                timespans: street.timespans.filter(
                  (time: any) =>
                    time &&
                    typeof time === "object" &&
                    typeof time.start === "string" &&
                    typeof time.end === "string"
                ),
              }))
          : [];

        // Return the full structured data
        const extractedData: ExtractedData = {
          responsible_entity: parsedResponse.responsible_entity || "",
          pins: validPins,
          streets: validStreets,
          markdown_text: parsedResponse.markdown_text || "",
        };

        return extractedData;
      } catch (parseError) {
        console.error("Failed to parse JSON response from AI:", parseError);
        return null;
      }
    }

    return null;
  } catch (error) {
    console.error("Error extracting structured data:", error);
    return null;
  }
}

// Legacy export for backward compatibility
export const extractAddresses = extractStructuredData;
