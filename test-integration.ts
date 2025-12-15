/**
 * Test the integrated geocoding router with Overpass API
 */

import dotenv from "dotenv";
import { geocodeIntersectionsForStreets } from "./lib/geocoding-router";
import { StreetSection } from "./lib/types";

// Load environment variables
dotenv.config({ path: ".env.local" });

async function testIntegration() {
  console.log("🧪 Testing integrated Overpass geocoding\n");

  const testStreets: StreetSection[] = [
    {
      street: "бул. Васил Левски",
      from: "бул. Цар Освободител",
      to: "бул. Евлоги и Христо Георгиеви",
      timespans: [],
    },
    {
      street: "ул. Русалка",
      from: "ул. Мърфи",
      to: "бул. Цар Освободител",
      timespans: [],
    },
  ];

  console.log(`Testing ${testStreets.length} street sections\n`);

  const results = await geocodeIntersectionsForStreets(testStreets);

  console.log("\n✅ Results:\n");
  console.log("=".repeat(80));

  results.forEach((coords, intersection) => {
    console.log(`\n✅ ${intersection}`);
    console.log(`   Coordinates: ${coords.lat}, ${coords.lng}`);
    console.log(
      `   Google Maps: https://www.google.com/maps?q=${coords.lat},${coords.lng}`
    );
  });

  console.log("\n" + "=".repeat(80));
  console.log(
    `\n✅ Found ${results.size} intersections from ${testStreets.length} street sections\n`
  );
}

testIntegration()
  .then(() => {
    console.log("Integration test completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Integration test failed:", error);
    process.exit(1);
  });
