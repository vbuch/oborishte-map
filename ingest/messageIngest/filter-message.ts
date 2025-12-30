import { filterMessage, type FilterResult } from "@/lib/ai-service";

/**
 * Filter and normalize message text
 * Removes transport-only content and determines relevance to public infrastructure
 */
export async function filterAndNormalizeMessage(
  text: string
): Promise<FilterResult | null> {
  const filterResult = await filterMessage(text);

  if (!filterResult) {
    console.error("Failed to filter message");
    return null;
  }

  // Validate response structure
  if (
    typeof filterResult.isRelevant !== "boolean" ||
    typeof filterResult.normalizedText !== "string"
  ) {
    console.error("Invalid filter result structure:", filterResult);
    return null;
  }

  return filterResult;
}
