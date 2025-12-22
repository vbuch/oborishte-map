import { NextResponse } from "next/server";
import { resolve } from "node:path";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes max execution time

export async function GET(request: Request) {
  // Verify the request is from Vercel Cron
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log("🕐 Cron job: Starting automated workflow...");

  const results = {
    crawl: { success: false, results: [] as any[] },
    ingest: { success: false, summary: null as any },
    notify: { success: false, message: "" },
    timestamp: new Date().toISOString(),
  };

  try {
    // Step 1: Crawl all sources
    console.log("\n📡 Step 1: Crawling sources...");
    const crawlResults = await Promise.allSettled([
      (async () => {
        const { crawl } = await import("@/lib/crawlers/rayon-oborishte-bg");
        await crawl();
        return { source: "rayon-oborishte-bg", success: true };
      })(),
      (async () => {
        const { crawl } = await import("@/lib/crawlers/sofiyska-voda");
        await crawl(false);
        return { source: "sofiyska-voda", success: true };
      })(),
      (async () => {
        const { crawl } = await import("@/lib/crawlers/toplo-bg");
        await crawl(false);
        return { source: "toplo-bg", success: true };
      })(),
      (async () => {
        const { crawl } = await import("@/lib/crawlers/sofia-bg");
        await crawl();
        return { source: "sofia-bg", success: true };
      })(),
    ]);

    results.crawl.results = crawlResults.map((result) => {
      if (result.status === "fulfilled") {
        return result.value;
      } else {
        return {
          source: "unknown",
          success: false,
          error: result.reason?.message || String(result.reason),
        };
      }
    });
    results.crawl.success = results.crawl.results.every((r) => r.success);

    // Step 2: Ingest messages from crawled sources
    console.log("\n📥 Step 2: Ingesting messages...");
    const { ingest } = await import("@/lib/messageIngest/from-sources");
    const boundariesPath = resolve(
      process.cwd(),
      "lib/messageIngest/boundaries/oborishte.geojson"
    );

    results.ingest.summary = await ingest({
      boundariesPath,
      dryRun: false,
    });
    results.ingest.success = true;

    console.log(`   ✅ Ingested: ${results.ingest.summary.ingested}`);
    console.log(
      `   ⏭️  Already exists: ${results.ingest.summary.alreadyIngested}`
    );
    console.log(`   ❌ Failed: ${results.ingest.summary.failed}`);

    // Step 3: Match and notify users
    console.log("\n🔔 Step 3: Matching and notifying...");
    const { main } = await import("@/lib/notifications/match-and-notify");
    await main();
    results.notify.success = true;
    results.notify.message = "Notifications processed successfully";

    console.log("\n✅ All steps completed successfully!");

    return NextResponse.json({
      success: true,
      ...results,
    });
  } catch (error) {
    console.error("❌ Cron job failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        ...results,
      },
      { status: 500 }
    );
  }
}
