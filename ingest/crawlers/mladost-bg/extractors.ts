import type { Page } from "playwright";
import type { PostLink } from "./types";
import { SELECTORS } from "./selectors";

/**
 * Extract post links from the index page
 *
 * Note: mladost.bg includes time information separately from the date,
 * so we need a custom implementation that extends the base extractor pattern.
 */
export async function extractPostLinks(page: Page): Promise<PostLink[]> {
  console.log("📋 Extracting post links from index page...");

  const posts = await page.evaluate(() => {
    const postLinks: Array<{
      url: string;
      title: string;
      date: string;
      time?: string;
    }> = [];

    const containers = document.querySelectorAll(".news");

    containers.forEach((container) => {
      const linkEl = container.querySelector('a[href*="?post_type=post&p="]');
      if (!linkEl) return;

      const url = (linkEl as HTMLAnchorElement).href;
      if (!url.includes("mladost.bg") || !url.includes("?post_type=post&p="))
        return;

      // Extract title
      const titleEl = container.querySelector(
        "h5.news-title, h4.news-title, .news-title"
      );
      const title = titleEl?.textContent?.trim() || "";

      // Extract date
      const dateEl = container.querySelector("span.date, .date");
      const date = dateEl?.textContent?.trim() || "";

      // Extract time (specific to mladost.bg)
      const timeEl = container.querySelector("span.time, .time");
      const time = timeEl?.textContent?.trim() || undefined;

      if (url && title) {
        postLinks.push({ url, title, date, time });
      }
    });

    return postLinks;
  });

  console.log(`📊 Found ${posts.length} posts on index page`);

  return posts;
}

/**
 * Extract post details from individual post page
 */
export async function extractPostDetails(
  page: Page
): Promise<{ title: string; dateText: string; contentHtml: string }> {
  const details = await page.evaluate(() => {
    // Extract title (mladost.bg uses h2, not h1)
    const titleEl = document.querySelector("h2, .news-title, h1");
    const title = titleEl?.textContent?.trim() || "";

    // Extract date/time from detail page if available
    const dateEl = document.querySelector(".news-date-time, time, .date");
    const dateText = dateEl?.textContent?.trim() || "";

    // Extract main content - use inclusive selection
    const contentEl = document.querySelector(
      ".section-content, article, .entry-content, main"
    );

    let contentHtml = "";
    if (contentEl) {
      // Clone the element to avoid modifying the page
      const clone = contentEl.cloneNode(true) as HTMLElement;

      // Only exclude absolutely necessary elements (scripts, styles)
      clone.querySelectorAll("script, style").forEach((el) => el.remove());

      contentHtml = clone.innerHTML;
    }

    return {
      title,
      dateText,
      contentHtml,
    };
  });

  return details;
}
