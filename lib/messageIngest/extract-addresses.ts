import { extractAddresses } from "@/lib/ai-service";
import { ExtractedData } from "@/lib/types";

/**
 * Step 2: Extract addresses from message text using AI
 * Pure function that uses AI to extract structured data
 */
export async function extractAddressesFromMessage(
  text: string
): Promise<ExtractedData | null> {
  const extractedData = await extractAddresses(text);

  return extractedData;
}
