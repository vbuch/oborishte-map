#!/usr/bin/env node

import dotenv from "dotenv";
import { resolve } from "node:path";
import { Browser } from "playwright";
import type { Firestore } from "firebase-admin/firestore";
import { SourceDocument, PostLink } from "./types";
import { launchBrowser } from "../shared/browser";
import { delay } from "@/lib/delay";
import { isUrlProcessed, saveSourceDocument } from "../shared/firestore";
import { extractPostLinks, extractPostDetails } from "./extractors";
import { buildWebPageSourceDocument } from "../shared/webpage-crawlers";
import { parseShortBulgarianDateTime } from "../shared/date-utils";

// Load environment variables from .env.local
dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const INDEX_URL =
  "https://mladost.bg/%d0%b2%d1%81%d0%b8%d1%87%d0%ba%d0%b8-%d0%bd%d0%be%d0%b2%d0%b8%d0%bd%d0%b8/%d0%b8%d0%bd%d1%84%d0%be%d1%80%d0%bc%d0%b0%d1%86%d0%b8%d1%8f-%d0%be%d1%82%d0%bd%d0%be%d1%81%d0%bd%d0%be-%d0%bf%d0%bb%d0%b0%d0%bd%d0%be%d0%b2%d0%b8%d1%82%d0%b5-%d1%80%d0%b5%d0%bc%d0%be%d0%bd%d1%82/";
const SOURCE_TYPE = "mladost-bg";
const DELAY_BETWEEN_REQUESTS = 2000; // 2 seconds

/**
 * Process a single post
 */
async function processPost(
  browser: Browser,
  postLink: PostLink,
  adminDb: Firestore
): Promise<void> {
  const { url, title, date, time } = postLink;

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
    const details = await extractPostDetails(page);

    // Combine date and time from index page for custom parser
    const dateText = time ? `${date} ${time}` : date;

    // Use buildWebPageSourceDocument with custom date parser for DD.MM.YY format
    const postDetails = buildWebPageSourceDocument(
      url,
      details.title || title, // Prefer detail page title, fallback to index
      dateText,
      details.contentHtml,
      SOURCE_TYPE,
      (dateStr) => {
        const [datePart, timePart] = dateStr.split(" ");
        return parseShortBulgarianDateTime(datePart, timePart);
      }
    ) as Omit<SourceDocument, "crawledAt">;

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
  console.log("🚀 Starting mladost-bg crawler...\n");
  console.log(`📍 Index URL: ${INDEX_URL}`);
  console.log(`🗄️  Source type: ${SOURCE_TYPE}\n`);

  // Import firebase-admin after env is loaded
  const { adminDb } = await import("@/lib/firebase-admin");

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
