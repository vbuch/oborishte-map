import { describe, it, expect } from "vitest";
import { validateAllAddressesGeocoded } from "@/lib/pipeline/convert-to-geojson";
import type { ExtractedData } from "@/lib/types";

describe(validateAllAddressesGeocoded, () => {
  it("should return empty array when all addresses are geocoded", () => {
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
      streets: [
        {
          street: "Main Street",
          from: "Corner A",
          to: "Corner B",
          timespans: [{ start: "2024-01-01", end: "2024-01-02" }],
        },
      ],
    };

    const geocodedMap = new Map([
      ["Address 1", { lat: 42, lng: 23 }],
      ["Address 2", { lat: 42.1, lng: 23.1 }],
      ["Corner A", { lat: 42.2, lng: 23.2 }],
      ["Corner B", { lat: 42.3, lng: 23.3 }],
    ]);

    const result = validateAllAddressesGeocoded(extractedData, geocodedMap);
    expect(result).toEqual([]);
  });

  it("should return missing pin addresses", () => {
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

    const geocodedMap = new Map([["Address 1", { lat: 42, lng: 23 }]]);

    const result = validateAllAddressesGeocoded(extractedData, geocodedMap);
    expect(result).toEqual(["Address 2"]);
  });

  it("should return missing street endpoints", () => {
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

    const geocodedMap = new Map([["Corner A", { lat: 42, lng: 23 }]]);

    const result = validateAllAddressesGeocoded(extractedData, geocodedMap);
    expect(result).toEqual(["Main Street to: Corner B"]);
  });

  it("should return missing from endpoint with street name", () => {
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

    const geocodedMap = new Map([["Corner B", { lat: 42, lng: 23 }]]);

    const result = validateAllAddressesGeocoded(extractedData, geocodedMap);
    expect(result).toEqual(["Main Street from: Corner A"]);
  });

  it("should return all missing addresses from both pins and streets", () => {
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
      streets: [
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
      ],
    };

    const geocodedMap = new Map([["Address 1", { lat: 42, lng: 23 }]]);

    const result = validateAllAddressesGeocoded(extractedData, geocodedMap);
    expect(result).toEqual([
      "Address 2",
      "Main Street from: Corner A",
      "Main Street to: Corner B",
      "Side Street from: Corner C",
      "Side Street to: Corner D",
    ]);
  });

  it("should handle empty pins and streets", () => {
    const extractedData: ExtractedData = {
      responsible_entity: "Test Entity",
      pins: [],
      streets: [],
    };

    const geocodedMap = new Map();

    const result = validateAllAddressesGeocoded(extractedData, geocodedMap);
    expect(result).toEqual([]);
  });

  it("should handle empty geocoded map", () => {
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

    const geocodedMap = new Map();

    const result = validateAllAddressesGeocoded(extractedData, geocodedMap);
    expect(result).toEqual([
      "Address 1",
      "Main Street from: Corner A",
      "Main Street to: Corner B",
    ]);
  });
});
