import { describe, it, expect } from "vitest";
import { filterAndNormalizeMessage } from "./filter-message";

describe("filterAndNormalizeMessage", () => {
  it("should validate filter result structure", async () => {
    // This test validates the structure, not the AI response
    // In a real scenario, we'd need to mock the AI service
    // For now, we just ensure the function exists and has the right signature
    expect(filterAndNormalizeMessage).toBeDefined();
    expect(typeof filterAndNormalizeMessage).toBe("function");
  });

  it("should handle invalid input gracefully", async () => {
    const result = await filterAndNormalizeMessage("");
    // Empty string should return null or handle gracefully
    expect(result).toBeNull();
  });
});
