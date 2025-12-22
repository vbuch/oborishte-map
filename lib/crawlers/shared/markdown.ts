import TurndownService from "turndown";

/**
 * Create a configured TurndownService instance for HTML to Markdown conversion
 */
export function createTurndownService(options?: {
  headingStyle?: "setext" | "atx";
  codeBlockStyle?: "indented" | "fenced";
}): TurndownService {
  return new TurndownService({
    headingStyle: options?.headingStyle ?? "atx",
    codeBlockStyle: options?.codeBlockStyle ?? "fenced",
  });
}

/**
 * Convert HTML to Markdown using Turndown
 */
export function htmlToMarkdown(
  html: string,
  service?: TurndownService
): string {
  const turndown = service ?? createTurndownService();
  return turndown.turndown(html);
}
