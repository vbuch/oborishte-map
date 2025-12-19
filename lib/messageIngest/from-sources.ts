#!/usr/bin/env node

import * as dotenv from "dotenv";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import type { Firestore } from "firebase-admin/firestore";
import { GeoJSONFeatureCollection } from "../types";
import * as turf from "@turf/turf";

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

function loadBoundaries(
  boundariesPath?: string
): GeoJSONFeatureCollection | null {
  if (!boundariesPath) {
    console.log("ℹ️  No boundaries specified, processing all sources");
    return null;
  }

  try {
    const absolutePath = resolve(process.cwd(), boundariesPath);
    const content = readFileSync(absolutePath, "utf-8");
    const geojson = JSON.parse(content) as GeoJSONFeatureCollection;

    console.log(`✅ Loaded boundaries from: ${absolutePath}`);
    console.log(`   Features: ${geojson.features.length}`);

    return geojson;
  } catch (error) {
    console.error(
      `❌ Failed to load boundaries from ${boundariesPath}:`,
      error
    );
    throw error;
  }
}

function isWithinBoundaries(
  sourceGeoJson: GeoJSONFeatureCollection,
  boundaries: GeoJSONFeatureCollection
): boolean {
  try {
    // Check if any feature in source intersects with boundaries
    for (const feature of sourceGeoJson.features) {
      if (!feature.geometry?.coordinates) {
        console.warn("⚠️  Skipping feature without valid geometry");
        continue;
      }

      if (checkFeatureIntersection(feature, boundaries)) {
        return true;
      }
    }

    return false;
  } catch (error) {
    console.warn("⚠️  Error checking boundaries intersection:", error);
    // In case of error, include the source to be safe
    return true;
  }
}

function checkFeatureIntersection(
  feature: any,
  boundaries: GeoJSONFeatureCollection
): boolean {
  const turfFeature = turf.feature(feature.geometry, feature.properties);

  for (const boundaryFeature of boundaries.features) {
    const turfBoundary = turf.feature(
      boundaryFeature.geometry,
      boundaryFeature.properties
    );

    try {
      // Check if geometries intersect
      if (
        turf.booleanIntersects(turfFeature, turfBoundary) ||
        turf.booleanWithin(turfFeature, turfBoundary) ||
        turf.booleanContains(turfBoundary, turfFeature)
      ) {
        return true;
      }
    } catch (intersectError) {
      // Some geometry types might not support all comparison operations
      // Try a simpler bounding box check instead
      if (
        checkBoundingBoxOverlap(
          turfFeature,
          turfBoundary,
          feature.geometry.type,
          intersectError
        )
      ) {
        return true;
      }
    }
  }

  return false;
}

function checkBoundingBoxOverlap(
  turfFeature: any,
  turfBoundary: any,
  geometryType: string,
  originalError: unknown
): boolean {
  try {
    const featureBbox = turf.bbox(turfFeature);
    const boundaryBbox = turf.bbox(turfBoundary);

    // Check if bounding boxes overlap
    const overlaps = !(
      (
        featureBbox[2] < boundaryBbox[0] || // feature is completely to the left
        featureBbox[0] > boundaryBbox[2] || // feature is completely to the right
        featureBbox[3] < boundaryBbox[1] || // feature is completely below
        featureBbox[1] > boundaryBbox[3]
      ) // feature is completely above
    );

    if (overlaps) {
      console.log(`ℹ️  Using bounding box check for ${geometryType} geometry`);
      return true;
    }

    return false;
  } catch (error) {
    const errorMessage =
      originalError instanceof Error
        ? originalError.message
        : String(originalError);
    const bboxErrorMessage =
      error instanceof Error ? error.message : String(error);
    console.warn(
      `⚠️  Could not check geometry intersection (${errorMessage}), bbox check also failed (${bboxErrorMessage}), including by default`
    );
    return true;
  }
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
    .where("source", "==", sourceUrl)
    .limit(1)
    .get();

  return !messagesSnapshot.empty;
}

async function ingestSource(
  source: SourceDocument,
  adminDb: Firestore,
  dryRun: boolean
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

  // Use the source URL as the source identifier for messageIngest
  await messageIngest(
    source.message,
    source.url,
    SYSTEM_USER_ID,
    SYSTEM_USER_EMAIL,
    {
      precomputedGeoJson: geoJson,
    }
  );

  console.log(`   ✅ Ingested: ${source.title}`);
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
  const firebase = await import("../firebase-admin");
  return firebase.adminDb;
}

async function ingest(): Promise<void> {
  const options = await parseArguments();

  console.log("📥 Starting source ingestion...\n");
  console.log(
    `🔧 Mode: ${options.dryRun ? "dry-run (no ingestion)" : "production"}`
  );

  const boundaries = loadBoundaries(options.boundariesPath);
  const adminDb = await maybeInitFirestore();

  const allSources = await fetchSources(adminDb, options);
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
    failed: 0,
    errors: [],
  };

  console.log("\n⚙️  Processing sources...\n");

  for (const source of withinBounds) {
    try {
      const wasIngested = await ingestSource(
        source,
        adminDb,
        options.dryRun ?? false
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
      summary.errors.push({ url: source.url, error: errorMessage });
      console.error(`   ❌ Failed to ingest ${source.title}:`, errorMessage);
    }
  }

  logSummary(summary, options.dryRun ?? false);
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

// eslint-disable-next-line unicorn/prefer-top-level-await
ingest().catch((error) => {
  console.error("❌ Ingestion failed:", error);
  process.exit(1);
});
