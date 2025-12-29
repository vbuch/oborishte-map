import { describe, expect, it } from "vitest";
import { formatBulgarianDateTime, parseBulgarianDateTime } from "./date-utils";

describe("parseBulgarianDateTime", () => {
  it("should parse valid Bulgarian date format", () => {
    const date = parseBulgarianDateTime("29.12.2025 10:51");

    expect(date.getDate()).toBe(29);
    expect(date.getMonth()).toBe(11); // December (0-indexed)
    expect(date.getFullYear()).toBe(2025);
    expect(date.getHours()).toBe(10);
    expect(date.getMinutes()).toBe(51);
  });

  it("should parse date with leading zeros", () => {
    const date = parseBulgarianDateTime("01.01.2025 09:05");

    expect(date.getDate()).toBe(1);
    expect(date.getMonth()).toBe(0); // January
    expect(date.getFullYear()).toBe(2025);
    expect(date.getHours()).toBe(9);
    expect(date.getMinutes()).toBe(5);
  });

  it("should parse midnight correctly", () => {
    const date = parseBulgarianDateTime("15.06.2025 00:00");

    expect(date.getHours()).toBe(0);
    expect(date.getMinutes()).toBe(0);
  });

  it("should parse end of day correctly", () => {
    const date = parseBulgarianDateTime("15.06.2025 23:59");

    expect(date.getHours()).toBe(23);
    expect(date.getMinutes()).toBe(59);
  });

  it("should throw error for invalid format - missing time", () => {
    expect(() => parseBulgarianDateTime("29.12.2025")).toThrow(
      'Date string does not match Bulgarian format "DD.MM.YYYY HH:MM"'
    );
  });

  it("should throw error for invalid format - wrong separator", () => {
    expect(() => parseBulgarianDateTime("29-12-2025 10:51")).toThrow(
      'Date string does not match Bulgarian format "DD.MM.YYYY HH:MM"'
    );
  });

  it("should throw error for invalid month", () => {
    expect(() => parseBulgarianDateTime("29.13.2025 10:51")).toThrow(
      "Invalid month: 13"
    );
  });

  it("should throw error for invalid day", () => {
    expect(() => parseBulgarianDateTime("32.12.2025 10:51")).toThrow(
      "Invalid day: 32"
    );
  });

  it("should throw error for invalid hour", () => {
    expect(() => parseBulgarianDateTime("29.12.2025 24:00")).toThrow(
      "Invalid hour: 24"
    );
  });

  it("should throw error for invalid minute", () => {
    expect(() => parseBulgarianDateTime("29.12.2025 10:60")).toThrow(
      "Invalid minute: 60"
    );
  });

  it("should throw error for non-existent date (Feb 31)", () => {
    expect(() => parseBulgarianDateTime("31.02.2025 10:51")).toThrow(
      "Invalid date (out of range)"
    );
  });

  it("should throw error for empty string", () => {
    expect(() => parseBulgarianDateTime("")).toThrow("Invalid date string");
  });

  it("should throw error for null/undefined", () => {
    expect(() => parseBulgarianDateTime(null as any)).toThrow(
      "Invalid date string"
    );
  });

  it("should handle leap year February 29", () => {
    const date = parseBulgarianDateTime("29.02.2024 12:00"); // 2024 is a leap year

    expect(date.getDate()).toBe(29);
    expect(date.getMonth()).toBe(1); // February
    expect(date.getFullYear()).toBe(2024);
  });

  it("should reject February 29 in non-leap year", () => {
    expect(() => parseBulgarianDateTime("29.02.2025 12:00")).toThrow(
      "Invalid date (out of range)"
    );
  });
});

describe("formatBulgarianDateTime", () => {
  it("should format date to Bulgarian format", () => {
    const date = new Date(2025, 11, 29, 10, 51); // December 29, 2025, 10:51
    const formatted = formatBulgarianDateTime(date);

    expect(formatted).toBe("29.12.2025 10:51");
  });

  it("should add leading zeros for single-digit values", () => {
    const date = new Date(2025, 0, 1, 9, 5); // January 1, 2025, 09:05
    const formatted = formatBulgarianDateTime(date);

    expect(formatted).toBe("01.01.2025 09:05");
  });

  it("should format midnight correctly", () => {
    const date = new Date(2025, 5, 15, 0, 0); // June 15, 2025, 00:00
    const formatted = formatBulgarianDateTime(date);

    expect(formatted).toBe("15.06.2025 00:00");
  });

  it("should round-trip correctly", () => {
    const original = "29.12.2025 10:51";
    const parsed = parseBulgarianDateTime(original);
    const formatted = formatBulgarianDateTime(parsed);

    expect(formatted).toBe(original);
  });
});
