#!/usr/bin/env node

import * as dotenv from "dotenv";
import { resolve } from "node:path";
import type { Firestore } from "firebase-admin/firestore";
import { GeoJSONFeatureCollection } from "@/lib/types";
import { isWithinBoundaries, loadBoundaries } from "@/lib/boundary-utils";

// Load environment variables
dotenv.config({ path: resolve(process.cwd(), ".env.local") });

interface SourceDocument {
  url: string;
  datePublished: string;
  title: string;
  message: string;
  sourceType: string;
  crawledAt: Date;
  geoJson?: string | GeoJSONFeatureCollection; // Can be stored as string in Firestore
  markdownText?: string; // Markdown-formatted message for display
}

interface IngestOptions {
  boundariesPath?: string;
  dryRun?: boolean;
  sourceType?: string;
  limit?: number;
}

interface IngestSummary {
  total: number;
  withinBounds: number;
  outsideBounds: number;
  ingested: number;
  alreadyIngested: number;
  filtered: number;
  failed: number;
  errors: Array<{ url: string; error: string }>;
}

const SYSTEM_USER_ID = "system";
const SYSTEM_USER_EMAIL = "system@oborishte-map.local";

async function parseArguments(): Promise<IngestOptions> {
  const args = process.argv.slice(2);
  const options: IngestOptions = {};

  for (const arg of args) {
    if (arg.startsWith("--boundaries=")) {
      options.boundariesPath = arg.split("=")[1];
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg.startsWith("--source-type=")) {
      options.sourceType = arg.split("=")[1];
    } else if (arg.startsWith("--limit=")) {
      options.limit = Number.parseInt(arg.split("=")[1], 10);
    }
  }

  return options;
}

async function fetchSources(
  adminDb: Firestore,
  options: IngestOptions
): Promise<SourceDocument[]> {
  console.log("\n📡 Fetching sources from Firestore...");

  let query = adminDb.collection("sources") as any;

  if (options.sourceType) {
    query = query.where("sourceType", "==", options.sourceType);
    console.log(`   ➜ Filtering by sourceType: ${options.sourceType}`);
  }

  if (options.limit) {
    query = query.limit(options.limit);
    console.log(`   ➜ Limiting to: ${options.limit} documents`);
  }

  const snapshot = await query.get();
  const sources: SourceDocument[] = [];

  for (const doc of snapshot.docs) {
    const data = doc.data();
    sources.push({
      url: data.url,
      datePublished: data.datePublished,
      title: data.title,
      message: data.message,
      sourceType: data.sourceType,
      crawledAt: data.crawledAt?.toDate() ?? new Date(),
      geoJson: data.geoJson,
      markdownText: data.markdownText,
    });
  }

  console.log(`✅ Fetched ${sources.length} source(s)`);
  return sources;
}

async function isAlreadyIngested(
  adminDb: Firestore,
  sourceUrl: string
): Promise<boolean> {
  // Check if a message already exists for this source URL
  const messagesSnapshot = await adminDb
    .collection("messages")
    .where("sourceUrl", "==", sourceUrl)
    .limit(1)
    .get();

  return !messagesSnapshot.empty;
}

async function ingestSource(
  source: SourceDocument,
  adminDb: Firestore,
  dryRun: boolean,
  boundaries: GeoJSONFeatureCollection | null
): Promise<boolean> {
  if (dryRun) {
    console.log(`   📝 [dry-run] Would ingest: ${source.title}`);
    return true;
  }

  // Check if already ingested
  const alreadyIngested = await isAlreadyIngested(adminDb, source.url);
  if (alreadyIngested) {
    console.log(`   ⏭️  Already ingested: ${source.title}`);
    return false;
  }

  // Prominent message header
  console.log(`\n${"=".repeat(80)}`);
  console.log(`📄 PROCESSING MESSAGE`);
  console.log(`   Title: ${source.title}`);
  console.log(`   URL: ${source.url}`);
  console.log(`   Source Type: ${source.sourceType}`);
  console.log(`${"=".repeat(80)}`);

  // Parse geoJson if it's a string
  let geoJson: GeoJSONFeatureCollection | null = null;
  if (source.geoJson) {
    if (typeof source.geoJson === "string") {
      geoJson = JSON.parse(source.geoJson) as GeoJSONFeatureCollection;
    } else {
      geoJson = source.geoJson;
    }
  }

  // Dynamically import messageIngest to avoid loading firebase-admin at startup
  const { messageIngest } = await import("./index");

  // Use the sourceType as the source identifier for messageIngest
  const message = await messageIngest(
    source.message,
    source.sourceType,
    SYSTEM_USER_ID,
    SYSTEM_USER_EMAIL,
    {
      precomputedGeoJson: geoJson,
      sourceUrl: source.url,
      boundaryFilter: boundaries ?? undefined,
      crawledAt: source.crawledAt,
      markdownText: source.markdownText,
    }
  );

  console.log(`\n✅ COMPLETED: ${source.title}`);
  console.log(`   Message ID: ${message.id}`);
  console.log(`${"=".repeat(80)}\n`);
  return true;
}

async function filterByBoundaries(
  sources: SourceDocument[],
  boundaries: GeoJSONFeatureCollection | null
): Promise<{ withinBounds: SourceDocument[]; outsideBounds: number }> {
  if (!boundaries) {
    return { withinBounds: sources, outsideBounds: 0 };
  }

  console.log("\n🗺️  Filtering sources by boundaries...");

  const withinBounds: SourceDocument[] = [];
  let outsideBounds = 0;

  for (const source of sources) {
    if (!source.geoJson) {
      // If no geoJson, we can't check boundaries, include it
      withinBounds.push(source);
      continue;
    }

    const geoJson =
      typeof source.geoJson === "string"
        ? (JSON.parse(source.geoJson) as GeoJSONFeatureCollection)
        : source.geoJson;

    // Validate GeoJSON structure
    if (
      !geoJson ||
      typeof geoJson !== "object" ||
      !Array.isArray(geoJson.features)
    ) {
      console.warn(`   ⚠️  Invalid GeoJSON for source: ${source.url}`);
      // Include sources with invalid GeoJSON to avoid skipping them
      withinBounds.push(source);
      continue;
    }

    if (isWithinBoundaries(geoJson, boundaries)) {
      withinBounds.push(source);
    } else {
      outsideBounds++;
    }
  }

  console.log(`   ✅ Within boundaries: ${withinBounds.length}`);
  console.log(`   ⏭️  Outside boundaries: ${outsideBounds}`);

  return { withinBounds, outsideBounds };
}

async function maybeInitFirestore(): Promise<Firestore> {
  const firebase = await import("@/lib/firebase-admin");
  return firebase.adminDb;
}

export async function ingest(
  options: IngestOptions = {}
): Promise<IngestSummary> {
  console.log("📥 Starting source ingestion...\n");
  console.log(
    `🔧 Mode: ${options.dryRun ? "dry-run (no ingestion)" : "production"}`
  );

  const boundaries = loadBoundaries(options.boundariesPath);
  const adminDb = await maybeInitFirestore();

  const allSources = await fetchSources(adminDb, options);

  // Note: For sources WITH precomputed geoJson (toplo-bg, sofiyska-voda),
  // we still do the boundary filtering here at the source level
  // For sources WITHOUT geoJson (rayon-oborishte-bg, sofia-bg),
  // filtering will happen during messageIngest after geocoding
  const { withinBounds, outsideBounds } = await filterByBoundaries(
    allSources,
    boundaries
  );

  const summary: IngestSummary = {
    total: allSources.length,
    withinBounds: withinBounds.length,
    outsideBounds,
    ingested: 0,
    alreadyIngested: 0,
    filtered: 0,
    failed: 0,
    errors: [],
  };

  console.log("\n⚙️  Processing sources...\n");

  for (const source of withinBounds) {
    try {
      const wasIngested = await ingestSource(
        source,
        adminDb,
        options.dryRun ?? false,
        boundaries
      );
      if (wasIngested) {
        summary.ingested++;
      } else {
        summary.alreadyIngested++;
      }
    } catch (error) {
      summary.failed++;
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // Don't log as error if it's just outside boundaries or filtered as irrelevant
      if (errorMessage.includes("No features within specified boundaries")) {
        console.log(
          `   ⏭️  ${source.title}: Outside boundaries after geocoding`
        );
      } else if (errorMessage.includes("Message filtering failed")) {
        summary.filtered++;
        console.log(`   ℹ️  ${source.title}: Filtered as irrelevant`);
      } else {
        summary.errors.push({ url: source.url, error: errorMessage });
        console.error(`   ❌ Failed to ingest ${source.title}:`, errorMessage);
      }
    }
  }

  logSummary(summary, options.dryRun ?? false);
  return summary;
}

function logSummary(summary: IngestSummary, dryRun: boolean): void {
  console.log("\n" + "=".repeat(60));
  console.log("📊 Ingestion Summary");
  console.log("=".repeat(60));
  console.log(`📦 Total sources fetched: ${summary.total}`);
  if (summary.withinBounds < summary.total) {
    console.log(`🗺️  Within boundaries: ${summary.withinBounds}`);
    console.log(`⏭️  Outside boundaries: ${summary.outsideBounds}`);
  }
  if (dryRun) {
    console.log(
      `📝 Would ingest: ${summary.withinBounds - summary.alreadyIngested}`
    );
  } else {
    console.log(`✅ Successfully ingested: ${summary.ingested}`);
    console.log(`⏭️  Already ingested (skipped): ${summary.alreadyIngested}`);
    if (summary.filtered > 0) {
      console.log(`🚦 Filtered as irrelevant: ${summary.filtered}`);
      const filterPercentage = (
        (summary.filtered / summary.withinBounds) *
        100
      ).toFixed(1);
      console.log(`   (${filterPercentage}% of messages within bounds)`);
    }
    if (summary.failed > 0) {
      console.log(`❌ Failed: ${summary.failed}`);
    }
  }
  console.log("=".repeat(60));

  if (summary.errors.length > 0) {
    console.log("\n❌ Errors:");
    for (const { url, error } of summary.errors) {
      console.log(`   • ${url}`);
      console.log(`     ${error}`);
    }
  }

  if (dryRun) {
    console.log(
      "\n💡 Dry-run mode: no messages were created. Run without --dry-run to ingest."
    );
  }
}
// Run only when executed directly
if (require.main === module) {
  // eslint-disable-next-line unicorn/prefer-top-level-await
  (async () => {
    const options = await parseArguments();
    await ingest(options);
  })().catch((error) => {
    console.error("❌ Ingestion failed:", error);
    process.exit(1);
  });
}
