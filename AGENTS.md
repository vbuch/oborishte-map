# Agent Development Guidelines

This document provides important patterns and guidance for AI agents working on the oborishte-map codebase.

## Table of Contents

- [Environment Variables & Firebase Admin](#environment-variables--firebase-admin)
- [TypeScript & GeoJSON Validation](#typescript--geojson-validation)
- [Crawler Development](#crawler-development)

---

## Environment Variables & Firebase Admin

### ⚠️ Critical: Import Order Matters

When writing scripts that use Firebase Admin SDK, **always use dynamic imports** after loading environment variables with `dotenv.config()`.

**❌ WRONG - Static import causes environment variables to be undefined:**

```typescript
import dotenv from "dotenv";
dotenv.config({ path: resolve(process.cwd(), ".env.local") });

import { adminDb } from "@/lib/firebase-admin"; // ❌ This runs before dotenv.config completes!

async function myScript() {
  // adminDb will fail - env vars not loaded yet
}
```

**✅ CORRECT - Dynamic import after dotenv.config:**

```typescript
import dotenv from "dotenv";
import { resolve } from "node:path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

async function myScript() {
  // Load Firebase Admin dynamically AFTER env vars are loaded
  const { adminDb } = await import("@/lib/firebase-admin");

  // Now adminDb works correctly
  const snapshot = await adminDb.collection("sources").get();
}
```

### Examples in Codebase

See these files for reference:

- [ingest/crawlers/toplo-bg/index.ts](../ingest/crawlers/toplo-bg/index.ts#L79)
- [ingest/crawlers/sofia-bg/index.ts](../ingest/crawlers/sofia-bg/index.ts#L235)
- [ingest/crawlers/rayon-oborishte-bg/index.ts](../ingest/crawlers/rayon-oborishte-bg/index.ts#L210)
- [ingest/notifications/match-and-notify.ts](../ingest/notifications/match-and-notify.ts#L515)

### Required Environment Variables

Firebase Admin SDK requires:

- `FIREBASE_SERVICE_ACCOUNT_KEY` - JSON service account credentials
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID` - Firebase project ID

These should be in `.env.local` files (gitignored).

---

## TypeScript & GeoJSON Validation

### Custom GeoJSON Types

The project uses **custom GeoJSON types** defined in [ingest/lib/types.ts](../ingest/lib/types.ts), not the npm `geojson` package.

**❌ WRONG:**

```typescript
import type { FeatureCollection } from "geojson";

interface MyData {
  geoJson: FeatureCollection; // ❌ Wrong type!
}
```

**✅ CORRECT:**

```typescript
import type { GeoJSONFeatureCollection } from "@/lib/types";

interface MyData {
  geoJson: GeoJSONFeatureCollection; // ✅ Correct custom type
}
```

### GeoJSON Structure

```typescript
export interface GeoJSONFeatureCollection {
  type: "FeatureCollection";
  features: GeoJSONFeature[];
}

export interface GeoJSONFeature {
  type: "Feature";
  geometry: GeoJSONGeometry;
  properties: Record<string, any>;
}

export type GeoJSONGeometry = GeoJSONPoint | GeoJSONLineString | GeoJSONPolygon;
```

### Coordinate Order

**CRITICAL:** GeoJSON uses **[longitude, latitude]** order (NOT lat/lng):

```typescript
// ✅ CORRECT
{
  type: "Point",
  coordinates: [23.3219, 42.6977]  // [lng, lat]
}

// ❌ WRONG
{
  type: "Point",
  coordinates: [42.6977, 23.3219]  // [lat, lng] - SWAPPED!
}
```

### Validation & Auto-Fix

Use the shared validation utilities in [ingest/crawlers/shared/geojson-validation.ts](../ingest/crawlers/shared/geojson-validation.ts):

```typescript
import { validateAndFixGeoJSON } from "../crawlers/shared/geojson-validation";

const rawGeoJson = JSON.parse(geoJsonString);
const validation = validateAndFixGeoJSON(rawGeoJson, "context-name");

if (!validation.isValid || !validation.geoJson) {
  console.warn("Invalid GeoJSON:");
  validation.errors.forEach((err) => console.warn(`  ${err}`));
  return;
}

// Log auto-fixes (e.g., swapped coordinates)
if (validation.warnings.length > 0) {
  console.warn("Fixed GeoJSON:");
  validation.warnings.forEach((warn) => console.warn(`  ${warn}`));
}

// Use the validated/fixed geoJson
const geoJson = validation.geoJson;
```

### Sofia Bounds Detection

The validation utilities auto-detect swapped coordinates using Sofia's geographic bounds:

- **Longitude:** 23.188 to 23.528 (west to east)
- **Latitude:** 42.605 to 42.83 (south to north)

If coordinates fall outside Sofia when using [lng, lat] but would be valid as [lat, lng], they are automatically swapped and logged.

### Feature Array vs FeatureCollection

Some data sources (like toplo.bg) provide GeoJSON as **an array of features** instead of a proper FeatureCollection:

**❌ WRONG - Raw array:**

```json
[
  {"type": "Feature", "geometry": {...}, "properties": {...}},
  {"type": "Feature", "geometry": {...}, "properties": {...}}
]
```

**✅ CORRECT - Wrapped in FeatureCollection:**

```json
{
  "type": "FeatureCollection",
  "features": [
    {"type": "Feature", "geometry": {...}, "properties": {...}},
    {"type": "Feature", "geometry": {...}, "properties": {...}}
  ]
}
```

**Always wrap feature arrays** before validation:

```typescript
const rawFeatures = JSON.parse(geoJsonString);
const rawGeoJson = Array.isArray(rawFeatures)
  ? { type: "FeatureCollection", features: rawFeatures }
  : rawFeatures;
const validation = validateAndFixGeoJSON(rawGeoJson, "context-name");
```

---

## Crawler Development

### Document ID Stability

**Always use stable identifiers for document URLs** to prevent duplicate records.

**❌ WRONG - Unstable ID:**

```typescript
const doc = {
  url: `https://example.com/incidents/${data.temporaryId}`, // ❌ Changes each crawl!
  // ...
};
```

**✅ CORRECT - Stable ID:**

```typescript
const doc = {
  url: `https://example.com/incidents/${data.permanentId}`, // ✅ Stable CMS ID
  // ...
};
```

The document ID is generated from the URL using base64 encoding. If the URL changes, a new document is created even if it represents the same logical item.

### GeoJSON in Crawlers

When creating crawlers that include GeoJSON:

1. **Use custom types:**

   ```typescript
   import type { GeoJSONFeatureCollection } from "../../lib/types";

   interface MySourceDocument {
     geoJson: GeoJSONFeatureCollection; // Not 'any', not npm 'geojson'
   }
   ```

2. **Validate after parsing:**

   ```typescript
   const rawGeoJson = JSON.parse(geoJsonString);
   const validation = validateAndFixGeoJSON(rawGeoJson, incidentName);

   if (!validation.isValid || !validation.geoJson) {
     console.warn(`⚠️  Invalid GeoJSON for "${incidentName}"`);
     return; // Skip this item
   }

   const geoJson = validation.geoJson;
   ```

3. **Log coordinate fixes:**
   ```typescript
   if (validation.warnings.length > 0) {
     console.warn(`⚠️  Fixed GeoJSON for "${incidentName}":`);
     validation.warnings.forEach((w) => console.warn(`   ${w}`));
   }
   ```

### Example Crawlers

Reference implementations:

- **With GeoJSON:** [ingest/crawlers/toplo-bg/](../ingest/crawlers/toplo-bg/) - Parses embedded GeoJSON
- **With GeoJSON:** [ingest/crawlers/sofiyska-voda/](../ingest/crawlers/sofiyska-voda/) - Builds GeoJSON from ArcGIS
- **Text only:** [ingest/crawlers/sofia-bg/](../ingest/crawlers/sofia-bg/) - Relies on AI extraction + geocoding

---

## Common Patterns

### Script Template

```typescript
#!/usr/bin/env node
import { resolve } from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  // Dynamic import AFTER dotenv.config
  const { adminDb } = await import("@/lib/firebase-admin");

  // Your code here
}

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}
```

### Testing Scripts

For scripts in `tmp/` directory (gitignored):

```bash
# From workspace root
npm run tsx tmp/my-script.ts

# Or from ingest/ directory
cd ingest
npm run tsx ../tmp/my-script.ts
```

---

## Troubleshooting

### "FIREBASE_SERVICE_ACCOUNT_KEY environment variable not found"

**Cause:** Static import of firebase-admin before dotenv.config() completes.

**Fix:** Use dynamic `await import()` as shown in the examples above.

### "Invalid GeoJSON structure"

**Causes:**

- Coordinates are swapped [lat, lng] instead of [lng, lat]
- Missing `type` or `features` fields
- Invalid coordinate ranges
- Non-closed polygon rings

**Fix:** Use `validateAndFixGeoJSON()` which auto-detects and fixes common issues.

### Duplicate Records Created

**Cause:** Document URL contains unstable identifiers that change between crawls.

**Fix:** Use stable IDs (like CMS ContentItemId) in URLs instead of temporary IDs.

---

## Resources

- [Firebase Admin Setup](../ingest/lib/firebase-admin.ts)
- [GeoJSON Types](../ingest/lib/types.ts)
- [GeoJSON Validation](../ingest/crawlers/shared/geojson-validation.ts)
- [Firestore Helpers](../ingest/crawlers/shared/firestore.ts)
