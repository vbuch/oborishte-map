import { describe, expect, it } from "vitest";
import { extractCustomerPoints } from "./extractors";

describe("extractCustomerPoints", () => {
  it("should extract valid customer points", () => {
    const points = {
      cnt: "3",
      "1": { lat: "42.6977", lon: "23.3219" },
      "2": { lat: "42.6980", lon: "23.3225" },
      "3": { lat: "42.6975", lon: "23.3210" },
    };

    const result = extractCustomerPoints(points);

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual([23.3219, 42.6977]); // [lng, lat]
    expect(result[1]).toEqual([23.3225, 42.698]);
    expect(result[2]).toEqual([23.321, 42.6975]);
  });

  it("should handle zero count", () => {
    const points = {
      cnt: "0",
    };

    const result = extractCustomerPoints(points);

    expect(result).toEqual([]);
  });

  it("should handle invalid count (NaN)", () => {
    const points = {
      cnt: "invalid",
      "1": { lat: "42.6977", lon: "23.3219" },
    };

    const result = extractCustomerPoints(points);

    expect(result).toEqual([]);
  });

  it("should skip missing points in sequence", () => {
    const points = {
      cnt: "3",
      "1": { lat: "42.6977", lon: "23.3219" },
      // "2" is missing
      "3": { lat: "42.6975", lon: "23.3210" },
    };

    const result = extractCustomerPoints(points);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual([23.3219, 42.6977]);
    expect(result[1]).toEqual([23.321, 42.6975]);
  });

  it("should skip points with invalid coordinates", () => {
    const points = {
      cnt: "3",
      "1": { lat: "42.6977", lon: "23.3219" },
      "2": { lat: "invalid", lon: "23.3225" },
      "3": { lat: "42.6975", lon: "NaN" },
    };

    const result = extractCustomerPoints(points);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual([23.3219, 42.6977]);
  });

  it("should skip malformed point objects", () => {
    const points = {
      cnt: "3",
      "1": { lat: "42.6977", lon: "23.3219" },
      "2": "not an object",
      "3": "also not valid", // invalid object
    };

    const result = extractCustomerPoints(points);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual([23.3219, 42.6977]);
  });

  it("should handle empty points object", () => {
    const points = {
      cnt: "5",
      // No actual point data
    };

    const result = extractCustomerPoints(points);

    expect(result).toEqual([]);
  });

  it("should correctly parse string coordinates with decimals", () => {
    const points = {
      cnt: "1",
      "1": { lat: "42.697700", lon: "23.321900" },
    };

    const result = extractCustomerPoints(points);

    expect(result).toHaveLength(1);
    expect(result[0][0]).toBeCloseTo(23.3219, 4);
    expect(result[0][1]).toBeCloseTo(42.6977, 4);
  });
});
