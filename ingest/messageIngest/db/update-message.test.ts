import { describe, it, expect } from "vitest";
import { processFieldsForFirestore } from "./process-fields";
import { FieldValue } from "firebase-admin/firestore";

describe("processFieldsForFirestore", () => {
  it("should pass through primitive values unchanged", () => {
    const fields = {
      text: "Hello world",
      count: 42,
      active: true,
      score: 3.14,
      empty: null,
    };

    const result = processFieldsForFirestore(fields);

    expect(result).toEqual({
      text: "Hello world",
      count: 42,
      active: true,
      score: 3.14,
      empty: null,
    });
  });

  it("should convert Date objects to server timestamps", () => {
    const fields = {
      createdAt: new Date("2024-01-01"),
      updatedAt: new Date(),
      finalizedAt: new Date("2024-12-30"),
    };

    const result = processFieldsForFirestore(fields);

    // All Date fields should be converted to FieldValue.serverTimestamp()
    expect(result.createdAt).toBeInstanceOf(FieldValue);
    expect(result.updatedAt).toBeInstanceOf(FieldValue);
    expect(result.finalizedAt).toBeInstanceOf(FieldValue);
  });

  it("should stringify complex objects", () => {
    const fields = {
      extractedData: {
        pins: [{ text: "ul. Oborishte 25", lat: 42.6977, lng: 23.3219 }],
        streets: [],
      },
      geoJson: {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: { type: "Point", coordinates: [23.3219, 42.6977] },
            properties: {},
          },
        ],
      },
      messageFilter: {
        isRelevant: true,
        normalizedText: "Ремонт на ул. Оборище",
      },
    };

    const result = processFieldsForFirestore(fields);

    expect(result.extractedData).toBe(JSON.stringify(fields.extractedData));
    expect(result.geoJson).toBe(JSON.stringify(fields.geoJson));
    expect(result.messageFilter).toBe(JSON.stringify(fields.messageFilter));

    // Verify we can parse back
    expect(JSON.parse(result.extractedData)).toEqual(fields.extractedData);
    expect(JSON.parse(result.geoJson)).toEqual(fields.geoJson);
    expect(JSON.parse(result.messageFilter)).toEqual(fields.messageFilter);
  });

  it("should handle mixed field types", () => {
    const fields = {
      text: "Original message",
      finalizedAt: new Date("2024-12-30"),
      extractedData: { pins: [], streets: [] },
      source: "rayon-oborishte-bg",
      count: 5,
    };

    const result = processFieldsForFirestore(fields);

    expect(result.text).toBe("Original message");
    expect(result.finalizedAt).toBeInstanceOf(FieldValue);
    expect(result.extractedData).toBe(
      JSON.stringify({ pins: [], streets: [] })
    );
    expect(result.source).toBe("rayon-oborishte-bg");
    expect(result.count).toBe(5);
  });

  it("should handle empty objects", () => {
    const fields = {
      data: {},
      metadata: {},
    };

    const result = processFieldsForFirestore(fields);

    expect(result.data).toBe("{}");
    expect(result.metadata).toBe("{}");
  });

  it("should handle arrays as objects", () => {
    const fields = {
      addresses: [
        { text: "ул. Оборище 25", lat: 42.6977, lng: 23.3219 },
        { text: "бул. Витоша 1", lat: 42.6887, lng: 23.3346 },
      ],
    };

    const result = processFieldsForFirestore(fields);

    expect(result.addresses).toBe(JSON.stringify(fields.addresses));
    expect(JSON.parse(result.addresses)).toEqual(fields.addresses);
  });

  it("should handle empty input", () => {
    const fields = {};

    const result = processFieldsForFirestore(fields);

    expect(result).toEqual({});
  });

  it("should handle nested objects", () => {
    const fields = {
      metadata: {
        source: "crawler",
        nested: {
          deep: {
            value: 123,
          },
        },
      },
    };

    const result = processFieldsForFirestore(fields);

    expect(result.metadata).toBe(JSON.stringify(fields.metadata));
    expect(JSON.parse(result.metadata)).toEqual(fields.metadata);
  });
});
