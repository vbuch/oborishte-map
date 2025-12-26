#!/usr/bin/env node

import { Command } from "commander";

const program = new Command();

program
  .name("ingest")
  .description(
    "Ingest source documents from Firestore into messages with geocoding"
  )
  .option("--dry-run", "Preview ingestion without creating messages")
  .option("--source-name <name>", "Filter by specific source type")
  .option(
    "--since <date>",
    "Only process sources published since this date (YYYY-MM-DD)"
  )
  .option(
    "--until <date>",
    "Only process sources published until this date (YYYY-MM-DD)"
  )
  .option(
    "--boundaries <path>",
    "Optional: Path to GeoJSON boundaries file for additional geographic filtering"
  )
  .option("--limit <number>", "Limit number of sources to process", parseInt)
  .addHelpText(
    "after",
    `
Examples:
  $ npx tsx ingest --dry-run
  $ npx tsx ingest --source-name rayon-oborishte-bg
  $ npx tsx ingest --since 2025-01-01 --until 2025-12-31
  $ npx tsx ingest --limit 10 --dry-run
`
  )
  .action(async (options) => {
    try {
      // Dynamically import to avoid loading dependencies at parse time
      const { ingest } = await import("./messageIngest/from-sources");

      const ingestOptions: any = {
        dryRun: options.dryRun,
        sourceType: options.sourceName,
        boundariesPath: options.boundaries,
        limit: options.limit,
      };

      // Add date filters if provided
      if (options.since) {
        ingestOptions.since = new Date(options.since);
      }
      if (options.until) {
        ingestOptions.until = new Date(options.until);
      }

      await ingest(ingestOptions);

      process.exit(0);
    } catch (error) {
      console.error("❌ Ingestion failed:", error);
      process.exit(1);
    }
  });

program.parse();
