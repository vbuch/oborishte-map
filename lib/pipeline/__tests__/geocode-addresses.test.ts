import { describe, it, expect } from "vitest";
import {
  findMissingStreetEndpoints,
  collectAllAddressesFromExtractedData,
} from "@/lib/pipeline/geocode-addresses";
import type { StreetSection, ExtractedData } from "@/lib/types";

describe(findMissingStreetEndpoints, () => {
  it("should return empty array when all endpoints are geocoded", () => {
    const streets: StreetSection[] = [
      {
        street: "Main Street",
        from: "Corner A",
        to: "Corner B",
        timespans: [{ start: "2024-01-01", end: "2024-01-02" }],
      },
    ];

    const geocodedMap = new Map([
      ["Corner A", { lat: 42, lng: 23 }],
      ["Corner B", { lat: 42.1, lng: 23.1 }],
    ]);

    const result = findMissingStreetEndpoints(streets, geocodedMap);
    expect(result).toEqual([]);
  });

  it("should return missing from endpoint", () => {
    const streets: StreetSection[] = [
      {
        street: "Main Street",
        from: "Corner A",
        to: "Corner B",
        timespans: [{ start: "2024-01-01", end: "2024-01-02" }],
      },
    ];

    const geocodedMap = new Map([["Corner B", { lat: 42.1, lng: 23.1 }]]);

    const result = findMissingStreetEndpoints(streets, geocodedMap);
    expect(result).toEqual(["Corner A"]);
  });

  it("should return missing to endpoint", () => {
    const streets: StreetSection[] = [
      {
        street: "Main Street",
        from: "Corner A",
        to: "Corner B",
        timespans: [{ start: "2024-01-01", end: "2024-01-02" }],
      },
    ];

    const geocodedMap = new Map([["Corner A", { lat: 42, lng: 23 }]]);

    const result = findMissingStreetEndpoints(streets, geocodedMap);
    expect(result).toEqual(["Corner B"]);
  });

  it("should return both missing endpoints", () => {
    const streets: StreetSection[] = [
      {
        street: "Main Street",
        from: "Corner A",
        to: "Corner B",
        timespans: [{ start: "2024-01-01", end: "2024-01-02" }],
      },
    ];

    const geocodedMap = new Map();

    const result = findMissingStreetEndpoints(streets, geocodedMap);
    expect(result).toEqual(["Corner A", "Corner B"]);
  });

  it("should handle multiple streets", () => {
    const streets: StreetSection[] = [
      {
        street: "Main Street",
        from: "Corner A",
        to: "Corner B",
        timespans: [{ start: "2024-01-01", end: "2024-01-02" }],
      },
      {
        street: "Side Street",
        from: "Corner C",
        to: "Corner D",
        timespans: [{ start: "2024-01-01", end: "2024-01-02" }],
      },
    ];

    const geocodedMap = new Map([
      ["Corner A", { lat: 42, lng: 23 }],
      ["Corner C", { lat: 42.2, lng: 23.2 }],
    ]);

    const result = findMissingStreetEndpoints(streets, geocodedMap);
    expect(result).toEqual(["Corner B", "Corner D"]);
  });

  it("should handle empty streets array", () => {
    const streets: StreetSection[] = [];
    const geocodedMap = new Map();

    const result = findMissingStreetEndpoints(streets, geocodedMap);
    expect(result).toEqual([]);
  });

  it("should handle streets with same endpoints", () => {
    const streets: StreetSection[] = [
      {
        street: "Main Street",
        from: "Corner A",
        to: "Corner B",
        timespans: [{ start: "2024-01-01", end: "2024-01-02" }],
      },
      {
        street: "Side Street",
        from: "Corner A",
        to: "Corner C",
        timespans: [{ start: "2024-01-01", end: "2024-01-02" }],
      },
    ];

    const geocodedMap = new Map([["Corner A", { lat: 42, lng: 23 }]]);

    const result = findMissingStreetEndpoints(streets, geocodedMap);
    // Should include duplicates as they're processed per street
    expect(result).toEqual(["Corner B", "Corner C"]);
  });
});

describe(collectAllAddressesFromExtractedData, () => {
  it("should collect addresses from pins only", () => {
    const extractedData: ExtractedData = {
      responsible_entity: "Test Entity",
      pins: [
        {
          address: "Address 1",
          timespans: [{ start: "2024-01-01", end: "2024-01-02" }],
        },
        {
          address: "Address 2",
          timespans: [{ start: "2024-01-01", end: "2024-01-02" }],
        },
      ],
      streets: [],
    };

    const result = collectAllAddressesFromExtractedData(extractedData);
    expect(result).toEqual(new Set(["Address 1", "Address 2"]));
  });

  it("should collect addresses from streets only", () => {
    const extractedData: ExtractedData = {
      responsible_entity: "Test Entity",
      pins: [],
      streets: [
        {
          street: "Main Street",
          from: "Corner A",
          to: "Corner B",
          timespans: [{ start: "2024-01-01", end: "2024-01-02" }],
        },
      ],
    };

    const result = collectAllAddressesFromExtractedData(extractedData);
    expect(result).toEqual(new Set(["Corner A", "Corner B"]));
  });

  it("should collect addresses from both pins and streets", () => {
    const extractedData: ExtractedData = {
      responsible_entity: "Test Entity",
      pins: [
        {
          address: "Address 1",
          timespans: [{ start: "2024-01-01", end: "2024-01-02" }],
        },
      ],
      streets: [
        {
          street: "Main Street",
          from: "Corner A",
          to: "Corner B",
          timespans: [{ start: "2024-01-01", end: "2024-01-02" }],
        },
      ],
    };

    const result = collectAllAddressesFromExtractedData(extractedData);
    expect(result).toEqual(new Set(["Address 1", "Corner A", "Corner B"]));
  });

  it("should deduplicate addresses", () => {
    const extractedData: ExtractedData = {
      responsible_entity: "Test Entity",
      pins: [
        {
          address: "Address 1",
          timespans: [{ start: "2024-01-01", end: "2024-01-02" }],
        },
        {
          address: "Address 1", // Duplicate
          timespans: [{ start: "2024-01-03", end: "2024-01-04" }],
        },
      ],
      streets: [
        {
          street: "Main Street",
          from: "Address 1", // Same as pin
          to: "Corner B",
          timespans: [{ start: "2024-01-01", end: "2024-01-02" }],
        },
      ],
    };

    const result = collectAllAddressesFromExtractedData(extractedData);
    expect(result).toEqual(new Set(["Address 1", "Corner B"]));
    expect(result.size).toBe(2);
  });

  it("should handle empty extracted data", () => {
    const extractedData: ExtractedData = {
      responsible_entity: "Test Entity",
      pins: [],
      streets: [],
    };

    const result = collectAllAddressesFromExtractedData(extractedData);
    expect(result).toEqual(new Set());
    expect(result.size).toBe(0);
  });

  it("should handle multiple streets with overlapping endpoints", () => {
    const extractedData: ExtractedData = {
      responsible_entity: "Test Entity",
      pins: [],
      streets: [
        {
          street: "Street 1",
          from: "Corner A",
          to: "Corner B",
          timespans: [{ start: "2024-01-01", end: "2024-01-02" }],
        },
        {
          street: "Street 2",
          from: "Corner B", // Shared endpoint
          to: "Corner C",
          timespans: [{ start: "2024-01-01", end: "2024-01-02" }],
        },
      ],
    };

    const result = collectAllAddressesFromExtractedData(extractedData);
    expect(result).toEqual(new Set(["Corner A", "Corner B", "Corner C"]));
    expect(result.size).toBe(3);
  });
});
