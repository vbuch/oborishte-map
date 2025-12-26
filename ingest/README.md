# Ingest Pipeline

Data collection and processing pipeline for OboApp. Collects infrastructure disruption notices from public sources (water, heating, road repairs) across Sofia, processes them into geocoded GeoJSON, and delivers notifications to interested users.

## Pipeline Overview

```mermaid
graph LR
    A[Public Sources] --> B[crawl.ts]
    B --> C[(Firestore: sources)]
    C --> D[ingest.ts]
    D --> E[(Firestore: messages)]
    E --> F[notify.ts]
    F --> G[Users via FCM]

    style B fill:#e1f5ff
    style D fill:#e1f5ff
    style F fill:#e1f5ff
```

## Components

- **[crawlers/](crawlers/README.md)** - Automated scrapers that fetch raw data from external sources
- **[messageIngest/](messageIngest/README.md)** - Processing pipeline: AI extraction → geocoding → GeoJSON conversion
- **[notifications/](notifications/README.md)** - Geographic matching and push notification delivery

## Usage

```bash
# Run a specific crawler
npm run crawl -- --source rayon-oborishte-bg

# Process all sources into messages
npm run ingest

# Send notifications for new messages
npm run notify
```

## Deployment

Dockerized for Google Cloud Run Jobs. See `Dockerfile` and `terraform/` directory.
