/**
 * Test script for street section geometry extraction
 */

import dotenv from "dotenv";
import { getStreetSectionGeometry } from "./lib/overpass-geocoding-service";

// Load environment variables from .env.local
dotenv.config({ path: ".env.local" });

async function testSectionGeometry() {
  console.log("🧪 Testing street section geometry extraction\n");

  // Test coordinates from our intersection test
  const startCoords = { lat: 42.692158, lng: 23.352158 }; // Султан тепе ∩ Буная
  const endCoords = { lat: 42.692277, lng: 23.351378 }; // Султан тепе ∩ Черковна

  const geometry = await getStreetSectionGeometry(
    "ул. Султан тепе",
    startCoords,
    endCoords
  );

  if (geometry) {
    console.log("\n✅ Successfully extracted street section!");
    console.log(`   Points: ${geometry.length}`);
    console.log(
      `   Start: [${geometry[0][1].toFixed(6)}, ${geometry[0][0].toFixed(6)}]`
    );
    console.log(
      `   End: [${geometry[geometry.length - 1][1].toFixed(6)}, ${geometry[
        geometry.length - 1
      ][0].toFixed(6)}]`
    );
    console.log("\n   Visualization URL:");
    const coords = geometry.map((p) => `${p[1]},${p[0]}`).join("|");
    console.log(
      `   https://www.google.com/maps/dir/${coords
        .split("|")
        .slice(0, 10)
        .join("/")}`
    );
  } else {
    console.log("\n❌ Failed to extract street section");
  }
}

// Run the test
testSectionGeometry()
  .then(() => {
    console.log("\nTest completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Test failed:", error);
    process.exit(1);
  });
