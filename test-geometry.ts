/**
 * Test script for Overpass-based intersection finding
 */

import dotenv from "dotenv";
import { overpassGeocodeIntersections } from "./lib/overpass-geocoding-service";

// Load environment variables from .env.local
dotenv.config({ path: ".env.local" });

async function testIntersections() {
  console.log("🧪 Testing Overpass API geometry-based intersection finding\n");

  // Test with well-known intersection in Sofia
  const testIntersections = [
    "ул. Султан тепе ∩ ул. Буная",
    "ул. Султан тепе ∩ ул. Черковна",
    "ул. Буная ∩ ул. Черковна",
  ];

  console.log(`Testing ${testIntersections.length} intersection(s):\n`);

  const results = await overpassGeocodeIntersections(testIntersections);

  console.log("\n\n✅ Results:\n");
  console.log("=".repeat(80));

  for (const result of results) {
    console.log(`\n✅ ${result.formattedAddress}`);
    console.log(
      `   Coordinates: ${result.coordinates.lat}, ${result.coordinates.lng}`
    );
    console.log(
      `   Google Maps: https://www.google.com/maps?q=${result.coordinates.lat},${result.coordinates.lng}`
    );
  }

  console.log("\n" + "=".repeat(80));
  console.log(
    `\n✅ Success rate: ${results.length}/${
      testIntersections.length
    } (${Math.round((results.length / testIntersections.length) * 100)}%)\n`
  );
}

// Run the test
testIntersections()
  .then(() => {
    console.log("Test completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Test failed:", error);
    process.exit(1);
  });
