import { parseBulgarianDate } from "./date-utils";
import { createTurndownService } from "./markdown";

const turndownService = createTurndownService();

/**
 * Build a SourceDocument from webpage content (HTML to Markdown conversion)
 * Used by WordPress-style crawlers like rayon-oborishte-bg and sofia-bg
 */
export function buildWebPageSourceDocument(
  url: string,
  title: string,
  dateText: string,
  contentHtml: string,
  sourceType: string,
  customDateParser?: (dateText: string) => string
): {
  url: string;
  title: string;
  datePublished: string;
  message: string;
  sourceType: string;
} {
  if (!title) {
    throw new Error(`Failed to extract title from ${url}`);
  }

  if (!contentHtml) {
    throw new Error(`Failed to extract content from ${url}`);
  }

  // Convert HTML to Markdown
  const message = turndownService.turndown(contentHtml);

  // Parse date to ISO format (use custom parser if provided)
  const datePublished = customDateParser
    ? customDateParser(dateText)
    : parseBulgarianDate(dateText);

  return {
    url,
    title,
    datePublished,
    message,
    sourceType,
  };
}
