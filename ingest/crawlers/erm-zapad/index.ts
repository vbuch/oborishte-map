#!/usr/bin/env node
import { resolve } from "node:path";
import dotenv from "dotenv";
import { delay } from "@/lib/delay";
import { validateAndFixGeoJSON } from "../shared/geojson-validation";
import { launchBrowser } from "../shared/browser";
import { saveSourceDocumentIfNew } from "../shared/firestore";
import { parseBulgarianDateTime } from "../shared/date-utils";
import { buildGeoJSON, buildMessage, buildTitle } from "./builders";
import type {
  ApiResponse,
  CrawlSummary,
  ErmZapadSourceDocument,
  Municipality,
  RawIncident,
} from "./types";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const BASE_URL = "https://info.ermzapad.bg";
const INDEX_URL = `${BASE_URL}/webint/vok/avplan.php`;
const API_URL = INDEX_URL;
const SOURCE_TYPE = "erm-zapad";

/**
 * Discover active София-град municipalities from the index page
 */
async function discoverMunicipalities(): Promise<Municipality[]> {
  console.log("🔍 Discovering София-град municipalities...");

  const browser = await launchBrowser();
  const page = await browser.newPage();

  try {
    await page.goto(INDEX_URL, { waitUntil: "networkidle" });

    const municipalities = await page.evaluate(() => {
      const results: Municipality[] = [];

      // Find the Sofia-City region card
      const headers = Array.from(document.querySelectorAll("h5.card-title"));
      const sofiaHeader = headers.find((h) =>
        h.textContent?.includes("Област София-град")
      );

      if (!sofiaHeader) {
        return results;
      }

      // Get the parent card-body
      const cardBody = sofiaHeader.closest("div.card-body");
      if (!cardBody) {
        return results;
      }

      // Find all municipality list items
      const listItems = cardBody.querySelectorAll("ul.list-group li");

      listItems.forEach((li) => {
        const onclick = li.getAttribute("onclick");
        if (!onclick) return;

        // Extract municipality code from onclick="show_obstina('SOF16','SOF'); ..."
        const match = /show_obstina\('([^']+)'/.exec(onclick);
        if (!match) return;

        const code = match[1];

        // Extract municipality name from text content
        const text = li.textContent?.trim() || "";
        // Format: "  община ПАНЧАРЕВО" - extract just the name
        const nameMatch = /община\s+(.+?)(?:\s|$)/i.exec(text);
        const name = nameMatch ? nameMatch[1].trim() : text;

        if (code && name) {
          results.push({ code, name });
        }
      });

      return results;
    });

    console.log(`   ✅ Found ${municipalities.length} municipalities`);
    municipalities.forEach((m) => console.log(`      • ${m.code}: ${m.name}`));

    return municipalities;
  } finally {
    await browser.close();
  }
}

/**
 * Fetch incidents for a specific municipality
 */
async function fetchMunicipalityIncidents(
  code: string
): Promise<RawIncident[]> {
  const formData = new URLSearchParams({
    action: "draw",
    gm_obstina: code,
    lat: "0",
    lon: "0",
  });

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      Accept: "*/*",
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    },
    body: formData.toString(),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch incidents for ${code}: ${response.status} ${response.statusText}`
    );
  }

  const data: ApiResponse = await response.json();

  // Convert object to array of incidents
  const incidents: RawIncident[] = [];
  for (const [, incident] of Object.entries(data)) {
    if (incident && typeof incident === "object") {
      incidents.push(incident);
    }
  }

  return incidents;
}

/**
 * Convert raw incident to source document
 */
function buildSourceDocument(
  incident: RawIncident
): ErmZapadSourceDocument | null {
  // Validate required fields
  if (!incident.ceo || typeof incident.ceo !== "string") {
    console.warn(`   ⚠️  Skipping incident without ceo identifier`);
    return null;
  }

  // Build GeoJSON
  const geoJson = buildGeoJSON(incident);
  if (!geoJson) {
    console.warn(`   ⚠️  Skipping incident without geometry: ${incident.ceo}`);
    return null;
  }

  // Validate and fix GeoJSON
  const validation = validateAndFixGeoJSON(geoJson, incident.ceo);
  if (!validation.isValid || !validation.geoJson) {
    console.warn(`   ⚠️  Invalid GeoJSON for ${incident.ceo}:`);
    validation.errors.forEach((err) => console.warn(`      ${err}`));
    return null;
  }

  // Log any coordinate fixes
  if (validation.warnings.length > 0) {
    console.warn(`   ⚠️  Fixed GeoJSON for ${incident.ceo}:`);
    validation.warnings.forEach((warn) => console.warn(`      ${warn}`));
  }

  const url = `${BASE_URL}/incidents/${incident.ceo}`;
  const title = buildTitle(incident);
  const message = buildMessage(incident);

  // Use incident start time as published date, fallback to current time
  let datePublished = new Date().toISOString();
  if (incident.begin_event) {
    try {
      datePublished = parseBulgarianDateTime(
        incident.begin_event
      ).toISOString();
    } catch (error) {
      console.warn(
        `   ⚠️  Invalid date format for ${incident.ceo}: ${incident.begin_event}`
      );
    }
  }

  return {
    url,
    datePublished,
    title,
    message,
    sourceType: SOURCE_TYPE,
    crawledAt: new Date(),
    geoJson: validation.geoJson,
  };
}

/**
 * Process incidents for a municipality
 */
async function processMunicipality(
  municipality: Municipality
): Promise<CrawlSummary> {
  console.log(`\n📍 Processing ${municipality.name} (${municipality.code})...`);

  const summary: CrawlSummary = { saved: 0, skipped: 0, failed: 0 };

  try {
    const incidents = await fetchMunicipalityIncidents(municipality.code);
    console.log(`   Found ${incidents.length} incident(s)`);

    if (incidents.length === 0) {
      return summary;
    }

    // Dynamic import after dotenv.config
    const { adminDb } = await import("@/lib/firebase-admin");

    for (const incident of incidents) {
      try {
        const doc = buildSourceDocument(incident);
        if (!doc) {
          summary.skipped++;
          continue;
        }

        const saved = await saveSourceDocumentIfNew(doc, adminDb);
        if (saved) {
          console.log(`   ✅ Saved: ${doc.title}`);
          summary.saved++;
        } else {
          summary.skipped++;
        }
      } catch (error) {
        console.error(
          `   ❌ Failed to process incident ${incident.ceo}:`,
          error
        );
        summary.failed++;
      }
    }
  } catch (error) {
    console.error(
      `   ❌ Failed to fetch incidents for ${municipality.code}:`,
      error
    );
    throw error; // Re-throw to fail the crawl
  }

  return summary;
}

/**
 * Main crawler function
 */
async function crawl(): Promise<void> {
  console.log("🚀 Starting ERM-Zapad crawler...\n");

  const startTime = Date.now();
  const totalSummary: CrawlSummary = { saved: 0, skipped: 0, failed: 0 };

  try {
    // Discover municipalities
    const municipalities = await discoverMunicipalities();

    if (municipalities.length === 0) {
      console.log("⚠️  No София-град municipalities found");
      return;
    }

    // Process each municipality
    for (const municipality of municipalities) {
      const summary = await processMunicipality(municipality);

      totalSummary.saved += summary.saved;
      totalSummary.skipped += summary.skipped;
      totalSummary.failed += summary.failed;

      // Delay between municipalities
      if (municipality !== municipalities.at(-1)) {
        await delay(2000); // 2 second delay
      }
    }

    // Final summary
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(
      `\n✅ Crawl complete in ${duration}s. Saved: ${totalSummary.saved}; Skipped: ${totalSummary.skipped}; Failed: ${totalSummary.failed}`
    );

    // Exit with error if all failed
    if (
      totalSummary.failed > 0 &&
      totalSummary.saved === 0 &&
      totalSummary.skipped === 0
    ) {
      console.error("\n❌ All incidents failed to process");
      process.exit(1);
    }
  } catch (error) {
    console.error("\n❌ Crawl failed:", error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  crawl().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}

export { crawl };
