import { GoogleGenAI } from "@google/genai";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ExtractedData } from "./types";
import { GEOCODING_ALGO, getDataExtractionPromptPath } from "./config";

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY || "" });

// Read the appropriate prompt template based on geocoding algorithm
let systemInstruction: string;
try {
  const promptPath = getDataExtractionPromptPath();
  const promptFile = promptPath.split("/").pop() || "data-extraction.md";
  console.log("reading system instruction:", promptPath);

  systemInstruction = readFileSync(join(process.cwd(), promptPath), "utf-8");

  console.log(`Loaded prompt template: ${promptFile} (for ${GEOCODING_ALGO})`);
} catch (error) {
  console.error("Failed to load prompt template:", error);
  throw new Error("Prompt template file not found");
}

export async function extractAddresses(
  text: string
): Promise<ExtractedData | null> {
  try {
    // Validate message
    if (!text || typeof text !== "string") {
      console.error("Invalid text parameter for address extraction");
      return null;
    }

    // Validate message length
    if (text.length > 5000) {
      console.error(
        "Text is too long for address extraction (max 5000 characters)"
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
    console.log("sanitizedText:", sanitizedText);
    console.log("model:", model);

    // Make request to Gemini API
    const response = await ai.models.generateContent({
      model: model,
      contents: sanitizedText,
      config: {
        systemInstruction,
      },
    });
    const responseText = response.text || "";

    // Log the response from Gemini API after address extraction
    console.log("Address extraction completed. AI Response:", responseText);

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
        };

        return extractedData;
      } catch (parseError) {
        console.error("Failed to parse JSON response from AI:", parseError);
        return null;
      }
    }

    return null;
  } catch (error) {
    console.error("Error extracting addresses:", error);
    return null;
  }
}
