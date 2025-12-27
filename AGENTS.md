# Agent Development Guidelines

This document provides important patterns and guidance for AI agents working on the oborishte-map codebase.

## Table of Contents

- [Environment Variables & Firebase Admin](#environment-variables--firebase-admin)
- [TypeScript & GeoJSON Validation](#typescript--geojson-validation)
- [Developer Preference Enforcement](#developer-preference-enforcement)
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

## Developer Preference Enforcement

### ⚠️ Critical: Enforce General Patterns, Not One-Offs

When you discover a developer preference during work, **proactively suggest enforcing it** if it represents a **general project approach**. This compounds code quality improvements over time.

### Three-Step Enforcement Workflow

**When you identify a pattern worth enforcing:**

1. **Apply the immediate change** requested by the developer
2. **Suggest appropriate automation** (linting rule, formatter config, type checker setting, git hook, etc.)
3. **Propose updating AGENTS.md** to document the pattern for future reference

**❌ WRONG - Apply change only:**

```typescript
// Developer says: "I prefer imports alphabetically ordered"
// Agent reorders imports in one file and stops

import { validateAndFixGeoJSON } from "../shared/geojson-validation";
import { adminDb } from "@/lib/firebase-admin";
import type { GeoJSONFeatureCollection } from "@/lib/types";
```

**✅ CORRECT - Apply change + suggest enforcement:**

```typescript
// Agent reorders imports in one file, then suggests:
// 1. Add ESLint plugin for import ordering
// 2. Update AGENTS.md with import ordering guideline
// 3. Run fix across codebase

import type { GeoJSONFeatureCollection } from "@/lib/types";
import { adminDb } from "@/lib/firebase-admin";
import { validateAndFixGeoJSON } from "../shared/geojson-validation";
```

### Documentation Criteria: General vs One-Off

**Before suggesting AGENTS.md updates, verify the pattern is widespread:**

**✅ DOCUMENT - General project approach:**

- Pattern exists in **10+ files** across the codebase
- Affects **architectural decisions** (error handling, file structure, API design)
- Relates to **correctness or maintainability** (not just personal preference)
- Developer states it as a **project standard** ("we always...", "our convention is...")

**❌ SKIP - One-off preference:**

- Applies to a **single file or feature**
- Purely **cosmetic** with no impact on correctness
- **Contradicts existing patterns** found elsewhere in codebase
- Developer states it as **personal preference** ("I like...", "I prefer...")

**How to verify:**

```bash
# Use grep_search or semantic_search to check pattern frequency
# Example: Check how many files use named exports
grep -r "export const" --include="*.ts" --include="*.tsx" | wc -l
grep -r "export default" --include="*.ts" --include="*.tsx" | wc -l
```

### Example Scenarios

#### Code Style Preferences

**Import Ordering:**

- **Preference:** "Imports should be alphabetically ordered with type imports first"
- **Automation:** ESLint plugin for import ordering, or TypeScript organize imports setting
- **AGENTS.md:** Add to Common Patterns section with example

**Naming Conventions:**

- **Preference:** "Use PascalCase for React components, camelCase for utilities"
- **Automation:** ESLint naming-convention rule
- **AGENTS.md:** Add to project-specific section if not standard TypeScript/React convention

#### Architectural Patterns

**Export Patterns:**

- **Preference:** "Prefer named exports over default exports for better refactoring"
- **Automation:** ESLint rule to forbid default exports
- **AGENTS.md:** Document in Common Patterns with rationale

**Error Handling:**

- **Preference:** "Always use try-catch with specific error logging in async functions"
- **Automation:** TypeScript strict mode, ESLint async patterns
- **AGENTS.md:** Add to Common Patterns with template

**File Organization:**

- **Preference:** "Co-locate test files with source (component.tsx + component.test.tsx)"
- **Automation:** Vitest config, file naming convention
- **AGENTS.md:** Document in project structure section

### Enforcement Tool Categories

When suggesting automation, consider these tool categories:

1. **Linters** - ESLint, TypeScript compiler, Biome
2. **Formatters** - Prettier, Biome, dprint
3. **Type Checkers** - TypeScript strict mode flags
4. **Git Hooks** - Husky, lint-staged (pre-commit formatting)
5. **Editor Config** - .editorconfig for cross-editor consistency
6. **CI/CD Checks** - GitHub Actions, pre-merge validation

### Workflow Example

**Developer request:** "I prefer imports alphabetically ordered on top of the file"

**Agent response:**

1. ✅ **Immediate fix:** Reorder imports in the current file
2. 🔍 **Pattern verification:** Search codebase for import patterns
3. 📊 **Analysis:** "Found mixed ordering in 45 files - this appears to be inconsistent"
4. 💡 **Suggestions:**
   - "Add ESLint import ordering rule to enforce this project-wide?"
   - "Run automated fix across all 45 files?"
   - "Update AGENTS.md Common Patterns section with import ordering guideline?"
5. 📝 **Proposed AGENTS.md addition:**

   ````markdown
   ### Import Organization

   **Always order imports alphabetically** with type imports first:

   ```typescript
   import type { MyType } from "./types";
   import { utilA, utilB } from "./utils";
   ```
   ````

   ```

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

### Working with Developer Preferences

When working on the codebase, if you identify a general project pattern or preference, see [Developer Preference Enforcement](#developer-preference-enforcement) for guidance on suggesting automation and documentation updates.

### DRY Principle: Shared Utilities

**This project follows DRY (Don't Repeat Yourself) very strictly.** Before implementing helper functions in API routes or components, check if a shared utility already exists or should be created.

**Common shared utilities locations:**

- **`web/lib/`** - Shared utilities for web/Next.js code
- **`ingest/lib/`** - Shared utilities for crawlers and ingestion scripts

**How to detect duplication:**

```bash
# Search for duplicate function signatures
grep -r "function convertTimestamp" web/app/api/**/*.ts
grep -r "function validateGeoJSON" ingest/crawlers/**/*.ts
```

**✅ CORRECT - Create shared utility:**

```typescript
// web/lib/firestore-utils.ts
export function convertTimestamp(timestamp: any): string {
  if (timestamp?._seconds) {
    return new Date(timestamp._seconds * 1000).toISOString();
  }
  if (timestamp?.toDate) {
    return timestamp.toDate().toISOString();
  }
  return timestamp || new Date().toISOString();
}
```

```typescript
// web/app/api/messages/route.ts
import { convertTimestamp } from "@/lib/firestore-utils";

const message = {
  createdAt: convertTimestamp(data.createdAt),
};
```

**❌ WRONG - Duplicate helpers in each file:**

```typescript
// Copied in messages/route.ts, interests/route.ts, etc.
function convertTimestamp(timestamp: any): string {
  // Same implementation copied 4+ times
}
```

**When creating new shared utilities:**

1. Check if similar functionality exists (use `grep_search` or `semantic_search`)
2. Create in appropriate `lib/` directory with descriptive name
3. Export named functions (prefer named exports over default)
4. Update all duplicate usages across the codebase
5. Propose AGENTS.md update if it establishes a new pattern

### Component Composition

**Break large components into smaller, focused components.** This improves readability, testability, and reusability.

**Component organization:**

- **Collocated components:** Keep component files next to the page/parent that uses them
- **Shared components:** Move to `web/components/` if used across multiple pages
- **File naming:** Use PascalCase for component files (e.g., `NotificationsSection.tsx`)

**✅ CORRECT - Small, focused components:**

```tsx
// web/app/settings/page.tsx
import NotificationsSection from "./NotificationsSection";
import ZonesSection from "./ZonesSection";
import DeleteAccountSection from "./DeleteAccountSection";

export default function SettingsPage() {
  // State and handlers
  return (
    <div>
      <NotificationsSection {...props} />
      <ZonesSection {...props} />
      <DeleteAccountSection {...props} />
    </div>
  );
}
```

```tsx
// web/app/settings/NotificationsSection.tsx
export default function NotificationsSection({
  subscriptions,
  onSubscribe,
}: NotificationsSectionProps) {
  // Single responsibility: manage notification subscriptions
  return <section>{/* ... */}</section>;
}
```

**❌ WRONG - Monolithic component:**

```tsx
// web/app/settings/page.tsx
export default function SettingsPage() {
  // 500+ lines of JSX for notifications, zones, and account deletion
  return (
    <div>
      {/* All sections inline, making the component hard to read and maintain */}
    </div>
  );
}
```

**Guidelines:**

- **Single responsibility:** Each component should do one thing well
- **Reasonable size:** Keep components under ~150 lines when possible
- **Props over drilling:** Pass callbacks and data as props, avoid prop drilling beyond 2 levels
- **Readonly props:** Mark all props interfaces as readonly

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
