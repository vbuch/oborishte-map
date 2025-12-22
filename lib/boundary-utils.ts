import * as turf from "@turf/turf";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { GeoJSONFeatureCollection } from "./types";

let cachedBoundary: GeoJSONFeatureCollection | null = null;

/**
 * Load boundaries from a GeoJSON file
 */
export function loadBoundaries(
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

/**
 * Load the Oborishte boundary from the default location (with caching)
 */
export function loadOborichteBoundary(): GeoJSONFeatureCollection {
  if (cachedBoundary) {
    return cachedBoundary;
  }

  const boundaryPath = resolve(
    process.cwd(),
    "lib/messageIngest/boundaries/oborishte.geojson"
  );
  const boundaryContent = readFileSync(boundaryPath, "utf-8");
  cachedBoundary = JSON.parse(boundaryContent) as GeoJSONFeatureCollection;
  return cachedBoundary;
}

/**
 * Check if bounding boxes overlap (fallback method)
 */
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

/**
 * Check if a feature intersects with any boundary feature
 */
export function checkFeatureIntersection(
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

/**
 * Filter GeoJSON features to only include those within boundaries
 * Returns a new FeatureCollection with only features that intersect the boundaries
 * Returns null if no features are within boundaries
 */
export function filterFeaturesByBoundaries(
  sourceGeoJson: GeoJSONFeatureCollection | null,
  boundaries: GeoJSONFeatureCollection
): GeoJSONFeatureCollection | null {
  if (
    !sourceGeoJson ||
    !sourceGeoJson.features ||
    sourceGeoJson.features.length === 0
  ) {
    return null;
  }

  const filteredFeatures = sourceGeoJson.features.filter((feature) => {
    if (!feature.geometry?.coordinates) {
      console.warn("⚠️  Skipping feature without valid geometry");
      return false;
    }

    return checkFeatureIntersection(feature, boundaries);
  });

  if (filteredFeatures.length === 0) {
    return null;
  }

  return {
    type: "FeatureCollection",
    features: filteredFeatures,
  };
}

/**
 * Check if a GeoJSON FeatureCollection is within boundaries
 */
export function isWithinBoundaries(
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
