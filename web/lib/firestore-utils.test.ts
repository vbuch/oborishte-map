import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { convertTimestamp } from "./firestore-utils";

describe("convertTimestamp", () => {
  beforeEach(() => {
    // Mock current time to ensure consistent test results
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should convert Firestore timestamp with _seconds property to ISO string", () => {
    const firestoreTimestamp = {
      _seconds: 1705320000, // 2024-01-15T12:00:00.000Z
      _nanoseconds: 0,
    };

    const result = convertTimestamp(firestoreTimestamp);

    expect(result).toBe("2024-01-15T12:00:00.000Z");
  });

  it("should handle Firestore timestamp with non-zero nanoseconds", () => {
    const firestoreTimestamp = {
      _seconds: 1705320000,
      _nanoseconds: 500000000, // 500ms, but should be ignored in current implementation
    };

    const result = convertTimestamp(firestoreTimestamp);

    // Current implementation only uses _seconds
    expect(result).toBe("2024-01-15T12:00:00.000Z");
  });

  it("should convert Firestore timestamp with toDate method to ISO string", () => {
    const mockDate = new Date("2024-06-20T15:30:00.000Z");
    const firestoreTimestamp = {
      toDate: () => mockDate,
    };

    const result = convertTimestamp(firestoreTimestamp);

    expect(result).toBe("2024-06-20T15:30:00.000Z");
  });

  it("should return ISO string if timestamp is already a string", () => {
    const isoString = "2024-03-10T10:00:00.000Z";

    const result = convertTimestamp(isoString);

    expect(result).toBe(isoString);
  });

  it("should return current date ISO string if timestamp is null", () => {
    const result = convertTimestamp(null);

    expect(result).toBe("2025-01-15T12:00:00.000Z");
  });

  it("should return current date ISO string if timestamp is undefined", () => {
    const result = convertTimestamp(undefined);

    expect(result).toBe("2025-01-15T12:00:00.000Z");
  });

  it("should return current date ISO string if timestamp is empty string", () => {
    const result = convertTimestamp("");

    expect(result).toBe("2025-01-15T12:00:00.000Z");
  });

  it("should prioritize _seconds over toDate if both exist", () => {
    const timestamp = {
      _seconds: 1705320000, // 2024-01-15T12:00:00.000Z
      toDate: () => new Date("2024-06-20T15:30:00.000Z"),
    };

    const result = convertTimestamp(timestamp);

    // _seconds should be checked first
    expect(result).toBe("2024-01-15T12:00:00.000Z");
  });

  it("should handle zero timestamp (Unix epoch)", () => {
    const firestoreTimestamp = {
      _seconds: 0,
      _nanoseconds: 0,
    };

    const result = convertTimestamp(firestoreTimestamp);

    expect(result).toBe("1970-01-01T00:00:00.000Z");
  });

  it("should handle negative timestamp (before Unix epoch)", () => {
    const firestoreTimestamp = {
      _seconds: -86400, // 1969-12-31T00:00:00.000Z
      _nanoseconds: 0,
    };

    const result = convertTimestamp(firestoreTimestamp);

    expect(result).toBe("1969-12-31T00:00:00.000Z");
  });
});
