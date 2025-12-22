#!/usr/bin/env node

import dotenv from "dotenv";
import { resolve } from "node:path";
import { Browser, Page } from "playwright";
import type { Firestore } from "firebase-admin/firestore";
import { SourceDocument, PostLink } from "./types";
import { SELECTORS } from "./selectors";
import { launchBrowser } from "../shared/browser";
import { createTurndownService } from "../shared/markdown";
import { delay } from "../shared/rate-limiting";
import { isUrlProcessed, saveSourceDocument } from "../shared/firestore";
import { parseBulgarianDate } from "../shared/date-utils";

// Load environment variables from .env.local
dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const INDEX_URL = "https://www.sofia.bg/repairs-and-traffic-changes";
const SOURCE_TYPE = "sofia-bg";
const DELAY_BETWEEN_REQUESTS = 2000; // 2 seconds

// Initialize Turndown for HTML to Markdown conversion
const turndownService = createTurndownService();

/**
 * Extract post links from the index page (first page only)
 */
async function extractPostLinks(page: Page): Promise<PostLink[]> {
  console.log("📋 Extracting post links from index page...");

  const posts = await page.evaluate((selectors) => {
    const postLinks: { url: string; title: string; date: string }[] = [];

    // Find all article containers
    const containers = document.querySelectorAll(
      selectors.INDEX.POST_CONTAINER
    );

    containers.forEach((container) => {
      // Find the link to the article
      const linkEl = container.querySelector(selectors.INDEX.POST_LINK);
      if (!linkEl) return;

      const url = (linkEl as HTMLAnchorElement).href;

      // Extract title
      const titleEl = container.querySelector(selectors.INDEX.POST_TITLE);
      const title = titleEl?.textContent?.trim() || "";

      // Extract date
      const dateEl = container.querySelector(selectors.INDEX.POST_DATE);
      const date = dateEl?.textContent?.trim() || "";

      if (url && title) {
        postLinks.push({ url, title, date });
      }
    });

    return postLinks;
  }, SELECTORS);

  console.log(`📊 Found ${posts.length} posts on index page`);
  return posts;
}

/**
 * Extract post details from individual post page
 */
async function extractPostDetails(
  page: Page,
  url: string
): Promise<Omit<SourceDocument, "crawledAt">> {
  console.log(`📄 Extracting details from: ${url}`);

  const details = await page.evaluate((selectors) => {
    // Extract title from first component-paragraph div
    // This contains the title text on sofia.bg article pages
    const componentParagraphs = document.querySelectorAll(
      ".component-paragraph"
    );
    let title = "";

    if (componentParagraphs.length > 0) {
      // First component-paragraph usually contains the title
      const firstParagraph = componentParagraphs[0] as HTMLElement;
      title = firstParagraph.textContent?.trim() || "";

      // If title is very long, it might include content, try to get just first line/paragraph
      const firstChild = firstParagraph.querySelector("p, div");
      if (
        firstChild &&
        firstChild.textContent &&
        firstChild.textContent.length < title.length
      ) {
        title = firstChild.textContent.trim();
      }
    }

    // Fallback to h1 or other headings if component-paragraph approach fails
    if (!title) {
      const headingEl = document.querySelector("h1, h2, h3");
      title = headingEl?.textContent?.trim() || "";
    }

    // Extract date - look for date in footer or date elements
    const dateEl = document.querySelector(selectors.POST.DATE);
    const dateText = dateEl?.textContent?.trim() || "";

    // Extract main content - get all component-paragraph divs
    let contentHtml = "";
    if (componentParagraphs.length > 0) {
      // Create a container for all paragraphs
      const container = document.createElement("div");
      componentParagraphs.forEach((p) => {
        const clone = p.cloneNode(true) as HTMLElement;
        // Remove unwanted elements
        clone
          .querySelectorAll(
            "script, style, nav, .navigation, .share-buttons, .social-share"
          )
          .forEach((el) => el.remove());
        container.appendChild(clone);
      });
      contentHtml = container.innerHTML;
    } else {
      // Fallback: get main-content
      const mainContent = document.querySelector("#main-content");
      if (mainContent) {
        const clone = mainContent.cloneNode(true) as HTMLElement;
        clone
          .querySelectorAll(
            "script, style, nav, .navigation, .share-buttons, .social-share, header, footer"
          )
          .forEach((el) => el.remove());
        contentHtml = clone.innerHTML;
      }
    }

    return {
      title,
      dateText,
      contentHtml,
    };
  }, SELECTORS);

  if (!details.title) {
    throw new Error(`Failed to extract title from ${url}`);
  }

  if (!details.contentHtml) {
    throw new Error(`Failed to extract content from ${url}`);
  }

  // Convert HTML to Markdown
  const message = turndownService.turndown(details.contentHtml);

  // Parse date to ISO format
  const datePublished = parseBulgarianDate(details.dateText);

  return {
    url,
    title: details.title,
    datePublished,
    message,
    sourceType: SOURCE_TYPE,
  };
}

/**
 * Process a single post
 */
async function processPost(
  browser: Browser,
  postLink: PostLink,
  adminDb: Firestore
): Promise<void> {
  const { url, title } = postLink;

  console.log(`\n🔍 Processing: ${title.substring(0, 60)}...`);

  // Check if already processed
  try {
    const alreadyProcessed = await isUrlProcessed(url, adminDb);
    if (alreadyProcessed) {
      console.log(`⏭️  Skipped (already processed): ${url}`);
      return;
    }
  } catch (error) {
    console.error(`❌ Error checking if URL is processed: ${url}`, error);
    throw error;
  }

  // Open new page for this post
  const page = await browser.newPage();

  try {
    console.log(`📥 Fetching: ${url}`);
    await page.goto(url, { waitUntil: "networkidle" });

    // Extract post details
    const postDetails = await extractPostDetails(page, url);

    // Save to Firestore
    const sourceDoc: SourceDocument = {
      ...postDetails,
      crawledAt: new Date(),
    };

    await saveSourceDocument(sourceDoc, adminDb);

    console.log(`✅ Successfully processed: ${title.substring(0, 60)}...`);
  } catch (error) {
    console.error(`❌ Error processing post: ${url}`, error);
    throw error;
  } finally {
    await page.close();
  }

  // Wait before next request
  await delay(DELAY_BETWEEN_REQUESTS);
}

/**
 * Main crawler function
 */
export async function crawl(options?: { headless?: boolean }): Promise<void> {
  const headless = options?.headless ?? true;

  console.log("🚀 Starting sofia-bg crawler...\n");
  console.log(`📍 Index URL: ${INDEX_URL}`);
  console.log(`🗄️  Source type: ${SOURCE_TYPE}`);
  console.log(`🖥️  Headless mode: ${headless}\n`);

  // Import firebase-admin after env is loaded
  const { adminDb } = await import("../../firebase-admin");

  let browser: Browser | null = null;

  try {
    // Launch browser
    console.log("🌐 Launching browser...");
    browser = await launchBrowser({ headless });

    // Open index page
    const page = await browser.newPage();
    console.log(`📥 Fetching index page: ${INDEX_URL}`);
    await page.goto(INDEX_URL, { waitUntil: "networkidle" });

    // Extract all post links from first page only
    const postLinks = await extractPostLinks(page);
    await page.close();

    if (postLinks.length === 0) {
      console.warn("⚠️ No posts found on index page");
      return;
    }

    console.log(`\n📊 Total posts to process: ${postLinks.length}\n`);

    // Process each post
    let processedCount = 0;
    let skippedCount = 0;

    for (const postLink of postLinks) {
      try {
        const wasProcessed = await isUrlProcessed(postLink.url, adminDb);

        if (wasProcessed) {
          skippedCount++;
        } else {
          await processPost(browser, postLink, adminDb);
          processedCount++;
        }
      } catch (error) {
        console.error(`❌ Error processing post: ${postLink.url}`, error);
        // Continue with next post
      }
    }

    console.log("\n" + "=".repeat(60));
    console.log("✅ Crawling completed successfully!");
    console.log(`📊 Total posts found: ${postLinks.length}`);
    console.log(`✅ Newly processed: ${processedCount}`);
    console.log(`⏭️  Skipped (already exists): ${skippedCount}`);
    console.log("=".repeat(60) + "\n");
  } catch (error) {
    console.error("\n" + "=".repeat(60));
    console.error("❌ Crawling failed with error:");
    console.error(error);
    console.error("=".repeat(60) + "\n");
    throw error;
  } finally {
    if (browser) {
      await browser.close();
      console.log("🔒 Browser closed");
    }
  }
}

// Run the crawler if executed directly
if (require.main === module) {
  const headless = !process.argv.includes("--no-headless");

  // eslint-disable-next-line unicorn/prefer-top-level-await
  crawl({ headless }).catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}
