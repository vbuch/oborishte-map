#!/usr/bin/env node

import dotenv from "dotenv";
import { resolve } from "node:path";
import type { Firestore } from "firebase-admin/firestore";
import {
  ArcGisFeature,
  ArcGisQueryResponse,
  LayerConfig,
  SofiyskaVodaSourceDocument,
} from "./types";
import { GeoJSONFeature, GeoJSONFeatureCollection } from "../../types";
import {
  isUrlProcessed,
  saveSourceDocument as saveSourceDocumentShared,
} from "../shared/firestore";

// Load environment variables to match the rest of the crawlers
dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const SOURCE_TYPE = "sofiyska-voda";
const BASE_URL =
  "https://gispx.sofiyskavoda.bg/arcgis/rest/services/WSI_PUBLIC/InfoCenter_Public/MapServer";
const REQUEST_HEADERS = {
  referer: "https://gispx.sofiyskavoda.bg/WebApp.InfoCenter/?a=0&tab=0",
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
  dnt: "1",
};
const PAGE_SIZE = 1000;
const REQUEST_TIMEOUT_MS = 15000;
const DATE_FORMATTER = new Intl.DateTimeFormat("bg-BG", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "Europe/Sofia",
});

const LAYERS: LayerConfig[] = [
  {
    id: 2,
    name: "Текущи спирания",
    titlePrefix: "Текущо спиране",
    where: "ACTIVESTATUS = 'In Progress'",
  },
  {
    id: 3,
    name: "Планирани спирания",
    titlePrefix: "Планирано спиране",
  },
];

const isDryRun = process.argv.includes("--dry-run");

interface CrawlSummary {
  saved: number;
  skipped: number;
  emptyLayers: number;
}

type FeatureProperty = string | number;
type NullableFeatureProperty = FeatureProperty | null;

async function fetchLayerFeatures(
  layer: LayerConfig
): Promise<ArcGisFeature[]> {
  let resultOffset = 0;
  const features: ArcGisFeature[] = [];

  while (true) {
    const params = new URLSearchParams({
      f: "json",
      where: layer.where ?? "1=1",
      outFields: "*",
      returnGeometry: "true",
      outSR: "4326",
      spatialRel: "esriSpatialRelIntersects",
      resultOffset: resultOffset.toString(),
      resultRecordCount: PAGE_SIZE.toString(),
      orderByFields: "START_ DESC",
    });

    const url = `${BASE_URL}/${layer.id}/query?${params.toString()}`;
    const payload = await callArcGis(url);

    if (payload.error) {
      throw new Error(
        `ArcGIS returned error for layer ${layer.id}: ${payload.error.message}`
      );
    }

    const batch = payload.features ?? [];
    features.push(...batch);

    if (!payload.exceededTransferLimit || batch.length === 0) {
      break;
    }

    resultOffset += PAGE_SIZE;
  }

  return features;
}

async function callArcGis(url: string): Promise<ArcGisQueryResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: REQUEST_HEADERS,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(
        `ArcGIS request failed (${response.status} ${response.statusText})`
      );
    }

    return (await response.json()) as ArcGisQueryResponse;
  } finally {
    clearTimeout(timeout);
  }
}

function getFeatureUrl(layerId: number, objectId: number): string {
  return `${BASE_URL}/${layerId}/${objectId}`;
}

function ensureDate(timestamp?: number | null): Date | null {
  if (!timestamp && timestamp !== 0) {
    return null;
  }

  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(date?: Date | null): string | null {
  if (!date) return null;
  return DATE_FORMATTER.format(date);
}

function sanitizeText(text?: string | null): string | null {
  if (!text) return null;
  const trimmed = text.replaceAll(/\s+/g, " ").trim();
  return trimmed.length > 0 ? trimmed : null;
}

function buildTitle(
  attributes: ArcGisFeature["attributes"],
  layer: LayerConfig
): string {
  const parts = [
    layer.titlePrefix,
    sanitizeText(attributes?.LOCATION),
    sanitizeText(attributes?.ALERTTYPE),
  ].filter(Boolean) as string[];

  if (parts.length === 0 && attributes?.ALERTID) {
    parts.push(`Инцидент ${attributes.ALERTID}`);
  }

  return (
    parts.join(" – ") ||
    `${layer.titlePrefix} ${attributes?.OBJECTID ?? ""}`.trim()
  );
}

function buildMessage(
  attributes: ArcGisFeature["attributes"],
  layer: LayerConfig
): string {
  const paragraphs: string[] = [];
  const location = sanitizeText(attributes?.LOCATION);
  const description = sanitizeText(attributes?.DESCRIPTION);

  if (location) {
    paragraphs.push(location);
  }

  if (description && description !== location) {
    paragraphs.push(description);
  }

  const startDate = formatDate(ensureDate(attributes?.START_));
  const endDate = formatDate(ensureDate(attributes?.ALERTEND));
  const lastUpdate = formatDate(ensureDate(attributes?.LASTUPDATE));

  const metadata = [
    `**Категория:** ${layer.name}`,
    attributes?.ACTIVESTATUS ? `**Статус:** ${attributes.ACTIVESTATUS}` : null,
    startDate ? `**Начало:** ${startDate}` : null,
    endDate ? `**Край:** ${endDate}` : null,
    lastUpdate ? `**Последно обновяване:** ${lastUpdate}` : null,
    attributes?.SOFIADISTRICT
      ? `**Район на СО (ID):** ${attributes.SOFIADISTRICT}`
      : null,
    attributes?.CONTACT ? `**Контакт:** ${attributes.CONTACT}` : null,
  ].filter(Boolean);

  if (metadata.length) {
    paragraphs.push(metadata.join("\n"));
  }

  return paragraphs.join("\n\n");
}

function buildFeatureProperties(
  attributes: ArcGisFeature["attributes"],
  layer: LayerConfig
): Record<string, FeatureProperty> {
  const sanitized = (
    value?: NullableFeatureProperty
  ): NullableFeatureProperty => {
    if (typeof value === "string") {
      return sanitizeText(value);
    }
    return value ?? null;
  };

  const rawEntries: [string, NullableFeatureProperty][] = [
    ["layerId", layer.id],
    ["layerName", layer.name],
    ["titlePrefix", layer.titlePrefix],
    ["alertId", attributes?.ALERTID ?? null],
    ["status", sanitized(attributes?.ACTIVESTATUS) ?? null],
    ["alertType", sanitized(attributes?.ALERTTYPE) ?? null],
    ["location", sanitized(attributes?.LOCATION) ?? null],
    ["district", attributes?.SOFIADISTRICT ?? null],
  ];

  const filteredEntries: [string, FeatureProperty][] = rawEntries
    .filter(([, value]) => value !== null && value !== "")
    .map(([key, value]) => [key, value as FeatureProperty]);

  return Object.fromEntries(filteredEntries);
}

function createFeatureCollection(
  feature: GeoJSONFeature
): GeoJSONFeatureCollection {
  return {
    type: "FeatureCollection",
    features: [feature],
  };
}

function buildGeoJsonFeatureCollection(
  feature: ArcGisFeature,
  layer: LayerConfig
): GeoJSONFeatureCollection | null {
  const geometry = feature.geometry;
  if (!geometry) {
    return null;
  }

  const properties = buildFeatureProperties(feature.attributes ?? {}, layer);

  if (geometry.rings?.length) {
    return createFeatureCollection({
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: geometry.rings as [number, number][][],
      },
      properties,
    });
  }

  if (geometry.paths?.length) {
    const firstPath = geometry.paths.find((path) => path.length > 1);
    if (firstPath) {
      return createFeatureCollection({
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: firstPath as [number, number][],
        },
        properties,
      });
    }
  }

  if (typeof geometry.x === "number" && typeof geometry.y === "number") {
    return createFeatureCollection({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [geometry.x, geometry.y],
      },
      properties,
    });
  }

  return null;
}

function buildSourceDocument(
  feature: ArcGisFeature,
  layer: LayerConfig
): SofiyskaVodaSourceDocument | null {
  const objectId = feature.attributes?.OBJECTID;
  if (typeof objectId !== "number") {
    console.warn(`⚠️ Skipping feature without OBJECTID in layer ${layer.id}`);
    return null;
  }

  const url = getFeatureUrl(layer.id, objectId);
  const message = buildMessage(feature.attributes, layer);
  const geoJson = buildGeoJsonFeatureCollection(feature, layer);
  if (!geoJson) {
    console.warn(`⚠️ Skipping feature without geometry: ${url}`);
    return null;
  }
  const lastUpdate =
    ensureDate(feature.attributes?.LASTUPDATE) ??
    ensureDate(feature.attributes?.START_) ??
    new Date();

  return {
    url,
    datePublished: lastUpdate.toISOString(),
    title: buildTitle(feature.attributes, layer),
    message,
    sourceType: SOURCE_TYPE,
    crawledAt: new Date(),
    geoJson,
  };
}

async function saveSourceDocument(
  doc: SofiyskaVodaSourceDocument,
  adminDb: Firestore
): Promise<void> {
  await saveSourceDocumentShared(doc, adminDb, {
    transformData: (d) => ({
      ...d,
      geoJson: JSON.stringify(d.geoJson),
      crawledAt: new Date(d.crawledAt),
    }),
    logSuccess: false,
  });
  console.log(`✅ Записано събитие: ${doc.title}`);
}

export async function crawl(dryRun = false): Promise<void> {
  console.log("🚰 Стартиране на crawler за Sofiyska Voda...\n");
  console.log(`🔧 Режим: ${dryRun ? "dry-run (без запис)" : "производствен"}`);

  const summary: CrawlSummary = { saved: 0, skipped: 0, emptyLayers: 0 };
  const seenUrls = new Set<string>();
  const adminDb = await maybeInitFirestore(dryRun);

  for (const layer of LAYERS) {
    const layerSummary = await processLayer(layer, seenUrls, adminDb, dryRun);
    summary.saved += layerSummary.saved;
    summary.skipped += layerSummary.skipped;
    summary.emptyLayers += layerSummary.emptyLayers;
  }

  logSummary(summary);
}

async function maybeInitFirestore(dryRun: boolean): Promise<Firestore | null> {
  if (dryRun) {
    return null;
  }

  const firebase = await import("../../firebase-admin");
  return firebase.adminDb;
}

async function processLayer(
  layer: LayerConfig,
  seenUrls: Set<string>,
  adminDb: Firestore | null,
  dryRun: boolean
): Promise<CrawlSummary> {
  console.log(`\n📡 Зареждане на слой ${layer.id} – ${layer.name}`);
  const features = await fetchLayerFeatures(layer);
  console.log(`   ➜ Получени записи: ${features.length}`);

  if (features.length === 0) {
    return { saved: 0, skipped: 0, emptyLayers: 1 };
  }

  const result: CrawlSummary = { saved: 0, skipped: 0, emptyLayers: 0 };

  for (const feature of features) {
    await handleFeature(feature, layer, seenUrls, adminDb, result, dryRun);
  }

  return result;
}

async function handleFeature(
  feature: ArcGisFeature,
  layer: LayerConfig,
  seenUrls: Set<string>,
  adminDb: Firestore | null,
  summary: CrawlSummary,
  dryRun: boolean
): Promise<void> {
  const document = buildSourceDocument(feature, layer);
  if (!document) {
    return;
  }

  if (seenUrls.has(document.url)) {
    return;
  }
  seenUrls.add(document.url);

  if (dryRun) {
    console.log(`📝 [dry-run] ${document.title}`);
    return;
  }

  if (!adminDb) {
    throw new Error("Firestore is not initialized");
  }

  const exists = await isUrlProcessed(document.url, adminDb);
  if (exists) {
    summary.skipped += 1;
    return;
  }

  await saveSourceDocument(document, adminDb);
  summary.saved += 1;
}

function logSummary(summary: CrawlSummary): void {
  console.log("\n" + "=".repeat(60));
  console.log("📊 Резюме на обработката");
  console.log(`✅ Нови записи: ${summary.saved}`);
  if (!isDryRun) {
    console.log(`⏭️  Пропуснати (вече съществуват): ${summary.skipped}`);
  }
  console.log(`ℹ️ Празни слоеве: ${summary.emptyLayers}`);
  console.log("=".repeat(60));

  if (isDryRun) {
    console.log(
      "💡 Dry-run режимът не записва в Firestore. Стартирайте без --dry-run за реално записване."
    );
  }
}

// Run only when executed directly
if (require.main === module) {
  const isDryRun = process.argv.includes("--dry-run");
  // eslint-disable-next-line unicorn/prefer-top-level-await
  crawl(isDryRun).catch((error) => {
    console.error("❌ Софийска вода crawler се провали:", error);
    process.exit(1);
  });
}
