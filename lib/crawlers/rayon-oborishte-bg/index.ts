#!/usr/bin/env node

import dotenv from "dotenv";
import { resolve } from "node:path";
import { Browser, Page } from "playwright";
import type { Firestore } from "firebase-admin/firestore";
import { SourceDocument, PostLink } from "./types";
import { launchBrowser } from "../shared/browser";
import { createTurndownService } from "../shared/markdown";
import { delay } from "../shared/rate-limiting";
import { isUrlProcessed, saveSourceDocument } from "../shared/firestore";
import { parseBulgarianDate } from "../shared/date-utils";

// Load environment variables from .env.local
dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const INDEX_URL =
  "https://rayon-oborishte.bg/%d1%83%d0%b2%d0%b5%d0%b4%d0%be%d0%bc%d0%bb%d0%b5%d0%bd%d0%b8%d1%8f-%d0%b7%d0%b0-%d1%80%d0%b5%d0%bc%d0%be%d0%bd%d1%82%d0%b8-%d1%81%d0%bc%d1%80-%d0%bf%d0%b8%d1%80%d0%be%d1%82%d0%b5%d1%85%d0%bd%d0%b8/";
const SOURCE_TYPE = "rayon-oborishte-bg";
const DELAY_BETWEEN_REQUESTS = 2000; // 2 seconds

// Initialize Turndown for HTML to Markdown conversion
const turndownService = createTurndownService();

/**
 * Extract post links from the index page
 */
async function extractPostLinks(page: Page): Promise<PostLink[]> {
  console.log("📋 Extracting post links from index page...");

  const posts = await page.evaluate(() => {
    const postLinks: { url: string; title: string; date: string }[] = [];

    // Find all article elements or post containers
    // Based on WordPress structure, each post is likely in an article or div with specific class
    const articles = document.querySelectorAll("article, .post");

    articles.forEach((article) => {
      // Find the link to the post
      const linkEl = article.querySelector('a[href*="rayon-oborishte.bg"]');
      if (!linkEl) return;

      const url = (linkEl as HTMLAnchorElement).href;

      // Skip if it's not a full post URL (avoid category links, etc.)
      if (
        !url.includes(
          "/%d1%83%d0%b2%d0%b5%d0%b4%d0%be%d0%bc%d0%bb%d0%b5%d0%bd%d0%b8%d0%b5-"
        )
      ) {
        return;
      }

      // Extract title - try h2, h3, or the link text
      const titleEl = article.querySelector("h2, h3, .entry-title") || linkEl;
      const title = titleEl.textContent?.trim() || "";

      // Extract date - look for time element or date class
      const dateEl = article.querySelector(
        'time, .date, .published, [class*="date"]'
      );
      const date = dateEl?.textContent?.trim() || "";

      if (url && title) {
        postLinks.push({ url, title, date });
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
async function extractPostDetails(
  page: Page,
  url: string
): Promise<Omit<SourceDocument, "crawledAt">> {
  console.log(`📄 Extracting details from: ${url}`);

  const details = await page.evaluate(() => {
    // Extract title
    const titleEl = document.querySelector("h1, .entry-title, .post-title");
    const title = titleEl?.textContent?.trim() || "";

    // Extract date
    const dateEl = document.querySelector(
      'time, .date, .published, [class*="date"]'
    );
    const dateText = dateEl?.textContent?.trim() || "";

    // Extract main content
    // Try to find the main content area and get its HTML
    const contentEl = document.querySelector(
      ".entry-content, .post-content, article .entry-content"
    );

    let contentHtml = "";
    if (contentEl) {
      // Clone the element to avoid modifying the page
      const clone = contentEl.cloneNode(true) as HTMLElement;

      // Remove unwanted elements (navigation, share buttons, etc.)
      clone
        .querySelectorAll(
          "script, style, nav, .sharedaddy, .share-buttons, .navigation, .post-navigation"
        )
        .forEach((el) => el.remove());

      contentHtml = clone.innerHTML;
    }

    return {
      title,
      dateText,
      contentHtml,
    };
  });

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
    throw error; // Re-throw to fail the entire process
  } finally {
    await page.close();
  }

  // Wait before next request
  await delay(DELAY_BETWEEN_REQUESTS);
}

/**
 * Main crawler function
 */
export async function crawl(): Promise<void> {
  console.log("🚀 Starting rayon-oborishte-bg crawler...\n");
  console.log(`📍 Index URL: ${INDEX_URL}`);
  console.log(`🗄️  Source type: ${SOURCE_TYPE}\n`);

  // Import firebase-admin after env is loaded
  const { adminDb } = await import("../../firebase-admin");

  let browser: Browser | null = null;

  try {
    // Launch browser
    console.log("🌐 Launching browser...");
    browser = await launchBrowser();

    // Open index page
    const page = await browser.newPage();
    console.log(`📥 Fetching index page: ${INDEX_URL}`);
    await page.goto(INDEX_URL, { waitUntil: "networkidle" });

    // Extract all post links
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
  // eslint-disable-next-line unicorn/prefer-top-level-await
  crawl().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}
