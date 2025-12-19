# Crawlers

Automated data collectors that fetch public notifications and disruptions from external sources, storing them as raw documents in Firestore.

## Available Crawlers

- **rayon-oborishte-bg** - Scrapes repair/disruption notices from Rayon Oborishte's website
- **sofiyska-voda** - Fetches water supply disruptions from Sofiyska Voda's ArcGIS API

## How They Work

Each crawler:

1. Fetches raw data from its source (web scraping or API)
2. Extracts structured information (title, content, dates, URLs)
3. Stores documents in Firestore with `sourceType` identifier
4. Tracks processed URLs to avoid duplicates

## Running Crawlers

```bash
npm run crawl:rayon-oborishte
npm run crawl:sofiyska-voda -- --dry-run  # preview mode
```

## Data Pipeline

```mermaid
flowchart LR
    A[External Sources] --> B[Crawlers]
    B --> C[Firestore Sources Documents]
    C --> D[messageIngest]
    D --> E[Firestore Messages Documents]
    E --> F[GeoJSON on Map]
```

After crawlers store raw documents, the [messageIngest](../messageIngest) pipeline processes them to extract addresses, geocode locations, and generate map-ready GeoJSON features.
