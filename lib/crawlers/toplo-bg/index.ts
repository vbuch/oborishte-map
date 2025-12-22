#!/usr/bin/env node
import dotenv from "dotenv";
import { resolve } from "node:path";
import type { Firestore } from "firebase-admin/firestore";
import type { FeatureCollection } from "geojson";
import { parseIncidents } from "./parser";
import { launchBrowser } from "../shared/browser";
import { encodeDocumentId, saveSourceDocumentIfNew } from "../shared/firestore";
import type { SourceDocumentWithGeoJson } from "../shared/types";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const SOURCE_TYPE = "toplo-bg";
const TARGET_URL = "https://toplo.bg/accidents-and-maintenance";

interface SourceDocument extends SourceDocumentWithGeoJson {
  sourceType: typeof SOURCE_TYPE;
}

interface CrawlSummary {
  saved: number;
  skipped: number;
  failed: number;
}

function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleString("bg-BG", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildMessage(
  name: string,
  fromDate: string,
  addresses: string,
  untilDate: string | null
): string {
  const parts = [name, "", formatDate(fromDate), addresses];

  if (untilDate) {
    parts.push("", `Очаквано възстановяване на ${formatDate(untilDate)}`);
  }

  return parts.join("\n");
}

export async function crawl(dryRun = false): Promise<void> {
  const summary: CrawlSummary = { saved: 0, skipped: 0, failed: 0 };

  console.log(`🔥 Fetching incidents from ${TARGET_URL}...`);

  // Launch browser and fetch HTML
  const browser = await launchBrowser();
  const page = await browser.newPage();
  await page.goto(TARGET_URL, { waitUntil: "networkidle" });
  const html = await page.content();
  await browser.close();

  console.log(`📄 Parsing incidents...`);

  // Parse incidents from HTML
  const incidents = parseIncidents(html);

  if (incidents.length === 0) {
    console.error("❌ No incidents found in HTML");
    process.exit(1);
  }

  console.log(`📊 Found ${incidents.length} incidents`);

  // Load Firebase Admin (lazy)
  const adminDb = dryRun
    ? null
    : (await import("../../firebase-admin")).adminDb;

  // Process each incident
  for (const incident of incidents) {
    try {
      const { info, geoJson } = incident;

      const doc: SourceDocument = {
        url: `https://toplo.bg/incidents/${info.AccidentId}`,
        datePublished: info.FromDate,
        title: info.Name,
        message: buildMessage(
          info.Name,
          info.FromDate,
          info.Addresses,
          info.UntilDate
        ),
        sourceType: SOURCE_TYPE,
        crawledAt: new Date(),
        geoJson,
      };

      if (dryRun) {
        console.log(`📝 [dry-run] ${doc.title}`);
        summary.saved++;
      } else if (adminDb) {
        const saved = await saveSourceDocumentIfNew(doc, adminDb, {
          transformData: (d) => ({
            ...d,
            geoJson: JSON.stringify(d.geoJson),
            crawledAt: new Date(d.crawledAt),
          }),
          logSuccess: false,
        });
        if (saved) {
          console.log(`✅ Saved: ${doc.title}`);
          summary.saved++;
        } else {
          console.log(`⏭️  Skipped (exists): ${doc.title}`);
          summary.skipped++;
        }
      }
    } catch (error) {
      console.warn(`⚠️  Failed to process incident:`, error);
      summary.failed++;
    }
  }

  // Print summary
  console.log("\n📈 Summary:");
  console.log(`   Saved: ${summary.saved}`);
  console.log(`   Skipped: ${summary.skipped}`);
  console.log(`   Failed: ${summary.failed}`);

  // Exit with error if all failed
  if (summary.failed > 0 && summary.saved === 0 && summary.skipped === 0) {
    console.error("\n❌ All incidents failed to process");
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  const isDryRun = process.argv.includes("--dry-run");
  crawl(isDryRun).catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}
