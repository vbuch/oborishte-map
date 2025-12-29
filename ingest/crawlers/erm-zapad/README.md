# ERM-Zapad Crawler

Crawler for power outage announcements from ERM-Zapad (ЕРМ Запад - Електроразпределение Запад).

## Source

- **Website:** https://info.ermzapad.bg/
- **Target Page:** https://info.ermzapad.bg/webint/vok/avplan.php
- **Source Type:** `erm-zapad`
- **Data Type:** GeoJSON-based (with pre-computed geographic coordinates)

## What it Crawls

This crawler fetches power outage incidents for **София-град** (Sofia-City) region municipalities. Each incident includes:

- Geographic coordinates (center point + customer locations)
- Incident type (planned/unplanned - планирано/непланирано)
- Time range (start and end datetime)
- Affected settlement (city/village name)
- Grid identifier (CEO code)

## How it Works

1. **Discovery Phase:**

   - Load the main page with Playwright
   - Extract София-град municipalities from the DOM
   - Parse municipality codes (e.g., SOF15, SOF16) from `onclick` handlers

2. **Fetch Phase:**

   - For each discovered municipality, POST to `avplan.php`
   - Request parameters: `action=draw&gm_obstina={code}&lat=0&lon=0`
   - Parse JSON response containing incidents

3. **GeoJSON Conversion:**

   - Extract customer points from each incident
   - Create Polygon geometry using turf.js convex hull (when 3+ points)
   - Create Point geometry from center coordinates (when no customer points)
   - Create MultiPoint geometry (when 1-2 customer points)
   - Validate coordinates with Sofia bounds checking

4. **Document Creation:**
   - Use `ceo` property as stable unique identifier
   - Build markdown message with incident details
   - Store GeoJSON in source document
   - Save to Firestore (skip duplicates via `saveIfNew`)

## API Response Format

The API returns a JSON object where each key is a numeric incident ID:

```json
{
  "1234": {
    "ceo": "SF_2742",
    "lat": "42.6740",
    "lon": "23.4403",
    "typedist": "непланирано",
    "type_event": "1",
    "begin_event": "29.12.2025 10:51",
    "end_event": "29.12.2025 12:15",
    "city_name": "БУСМАНЦИ",
    "grid_id": "",
    "cities": "",
    "points": {
      "cnt": "3",
      "1": { "lat": "42.6741", "lon": "23.4408" },
      "2": { "lat": "42.6747", "lon": "23.4403" },
      "3": { "lat": "42.6738", "lon": "23.4398" }
    }
  }
}
```

## Ingestion Flow

Since this crawler provides **pre-computed GeoJSON**, the ingestion pipeline skips:

- ❌ AI address extraction (not needed)
- ❌ Geocoding API calls (not needed)
- ✅ Direct GeoJSON ingestion
- ✅ Boundary filtering (Oborishte bounds applied during ingestion)

## Schedule

Configured in terraform to run **3 times daily**:

- 10:20, 14:20, 16:20 (Europe/Sofia timezone)

## Source Document Schema

```typescript
{
  url: "https://info.ermzapad.bg/incidents/{ceo}",
  datePublished: "2025-12-29T10:00:00.000Z", // Current crawl time
  title: "Непланирано спиране - БУСМАНЦИ - SF_2742",
  message: "Markdown formatted incident details",
  sourceType: "erm-zapad",
  crawledAt: Date,
  geoJson: GeoJSONFeatureCollection // Stringified when saved
}
```

## Testing

Run the crawler locally:

```bash
cd ingest
npm run tsx crawlers/erm-zapad/index.ts
```

Run unit tests:

```bash
cd ingest
npm run test:run
```
