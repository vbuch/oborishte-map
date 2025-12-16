import { describe, it, expect } from "vitest";
import { buildMessageResponse } from "@/lib/pipeline/build-response";
import type {
  Address,
  ExtractedData,
  GeoJSONFeatureCollection,
} from "@/lib/types";

describe(buildMessageResponse, () => {
  const mockAddress: Address = {
    originalText: "Test Street 123",
    formattedAddress: "Test Street 123, City",
    coordinates: { lat: 42, lng: 23 },
  };

  const mockExtractedData: ExtractedData = {
    responsible_entity: "Test Entity",
    pins: [
      {
        address: "Test Street 123",
        timespans: [{ start: "2024-01-01", end: "2024-01-02" }],
      },
    ],
    streets: [],
  };

  const mockGeoJson: GeoJSONFeatureCollection = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [23, 42],
        },
        properties: { address: "Test Street 123" },
      },
    ],
  };

  it("should build message response with all fields", async () => {
    const result = await buildMessageResponse(
      "msg-123",
      "Test message",
      [mockAddress],
      mockExtractedData,
      mockGeoJson
    );

    expect(result).toMatchObject({
      id: "msg-123",
      text: "Test message",
      addresses: [mockAddress],
      extractedData: mockExtractedData,
      geoJson: mockGeoJson,
    });
    expect(result.createdAt).toBeDefined();
    expect(typeof result.createdAt).toBe("string");
  });

  it("should handle null extractedData", async () => {
    const result = await buildMessageResponse(
      "msg-123",
      "Test message",
      [mockAddress],
      null,
      mockGeoJson
    );

    expect(result.extractedData).toBeUndefined();
  });

  it("should handle null geoJson", async () => {
    const result = await buildMessageResponse(
      "msg-123",
      "Test message",
      [mockAddress],
      mockExtractedData,
      null
    );

    expect(result.geoJson).toBeUndefined();
  });

  it("should handle empty addresses array", async () => {
    const result = await buildMessageResponse(
      "msg-123",
      "Test message",
      [],
      null,
      null
    );

    expect(result.addresses).toEqual([]);
    expect(result.extractedData).toBeUndefined();
    expect(result.geoJson).toBeUndefined();
  });

  it("should generate valid ISO timestamp", async () => {
    const result = await buildMessageResponse(
      "msg-123",
      "Test message",
      [],
      null,
      null
    );

    // Check if createdAt is a valid ISO string
    expect(() => new Date(result.createdAt)).not.toThrow();
    const date = new Date(result.createdAt);
    expect(date.toISOString()).toBe(result.createdAt);
  });

  it("should preserve all input data unchanged", async () => {
    const result = await buildMessageResponse(
      "msg-456",
      "Another message",
      [mockAddress],
      mockExtractedData,
      mockGeoJson
    );

    expect(result.id).toBe("msg-456");
    expect(result.text).toBe("Another message");
    expect(result.addresses).toEqual([mockAddress]); // Check array contents
    expect(result.extractedData).toBe(mockExtractedData); // Same reference
    expect(result.geoJson).toBe(mockGeoJson); // Same reference
  });
});
