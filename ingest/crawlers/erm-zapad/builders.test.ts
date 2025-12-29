import { describe, expect, it } from "vitest";
import type { RawIncident } from "./types";
import { buildGeoJSON, buildMessage, buildTitle } from "./builders";

describe("buildMessage", () => {
  it("should build complete message with all fields", () => {
    const incident: RawIncident = {
      ceo: "12345",
      typedist: "Планирано прекъсване",
      type_event: "1",
      city_name: "София",
      grid_id: "",
      cities: "",
      begin_event: "29.12.2025 10:00",
      end_event: "29.12.2025 16:00",
      lat: "42.6977",
      lon: "23.3219",
      points: { cnt: "0" },
    };

    const message = buildMessage(incident);

    expect(message).toContain("**Планирано прекъсване**");
    expect(message).toContain("**Населено място:** София");
    expect(message).toContain("**Начало:** 29.12.2025 10:00");
    expect(message).toContain("**Край:** 29.12.2025 16:00");
    expect(message).toContain("**Мрежов код:** 12345");
  });

  it("should build message without optional fields", () => {
    const incident: RawIncident = {
      ceo: "12345",
      typedist: "Авария",
      type_event: "1",
      city_name: "",
      grid_id: "",
      cities: "",
      begin_event: "",
      end_event: "",
      lat: "42.6977",
      lon: "23.3219",
      points: { cnt: "0" },
    };

    const message = buildMessage(incident);

    expect(message).toContain("**Авария**");
    expect(message).not.toContain("**Населено място:**");
    expect(message).not.toContain("**Начало:**");
    expect(message).not.toContain("**Край:**");
    expect(message).toContain("**Мрежов код:** 12345");
  });

  it("should build message with only start date", () => {
    const incident: RawIncident = {
      ceo: "12345",
      typedist: "Авария",
      type_event: "1",
      city_name: "София",
      grid_id: "",
      cities: "",
      begin_event: "29.12.2025 10:00",
      end_event: "",
      lat: "42.6977",
      lon: "23.3219",
      points: { cnt: "0" },
    };

    const message = buildMessage(incident);

    expect(message).toContain("**Начало:** 29.12.2025 10:00");
    expect(message).not.toContain("**Край:**");
  });

  it("should preserve newlines and formatting", () => {
    const incident: RawIncident = {
      ceo: "12345",
      typedist: "Планирано прекъсване",
      type_event: "1",
      city_name: "София",
      grid_id: "",
      cities: "",
      begin_event: "29.12.2025 10:00",
      end_event: "29.12.2025 16:00",
      lat: "42.6977",
      lon: "23.3219",
      points: { cnt: "0" },
    };

    const message = buildMessage(incident);
    const lines = message.split("\n");

    expect(lines[0]).toBe("**Планирано прекъсване**");
    expect(lines[1]).toBe("");
    expect(lines[2]).toBe("**Населено място:** София");
  });
});

describe("buildTitle", () => {
  it("should build title with all components", () => {
    const incident: RawIncident = {
      ceo: "12345",
      typedist: "Планирано прекъсване",
      type_event: "1",
      city_name: "София",
      grid_id: "",
      cities: "",
      begin_event: "29.12.2025 10:00",
      end_event: "29.12.2025 16:00",
      lat: "42.6977",
      lon: "23.3219",
      points: { cnt: "0" },
    };

    const title = buildTitle(incident);

    expect(title).toBe("Планирано прекъсване - София - 12345");
  });

  it("should build title without city name", () => {
    const incident: RawIncident = {
      ceo: "12345",
      typedist: "Авария",
      type_event: "1",
      city_name: "",
      grid_id: "",
      cities: "",
      begin_event: "",
      end_event: "",
      lat: "42.6977",
      lon: "23.3219",
      points: { cnt: "0" },
    };

    const title = buildTitle(incident);

    expect(title).toBe("Авария - 12345");
  });

  it("should build title with only incident type", () => {
    const incident: RawIncident = {
      ceo: "",
      typedist: "Авария",
      type_event: "1",
      city_name: "",
      grid_id: "",
      cities: "",
      begin_event: "",
      end_event: "",
      lat: "42.6977",
      lon: "23.3219",
      points: { cnt: "0" },
    };

    const title = buildTitle(incident);

    expect(title).toBe("Авария");
  });

  it("should use hyphens as separator", () => {
    const incident: RawIncident = {
      ceo: "12345",
      typedist: "Планирано прекъсване",
      type_event: "1",
      city_name: "София",
      grid_id: "",
      cities: "",
      begin_event: "",
      end_event: "",
      lat: "42.6977",
      lon: "23.3219",
      points: { cnt: "0" },
    };

    const title = buildTitle(incident);

    expect(title).toContain(" - ");
    expect(title.split(" - ")).toHaveLength(3);
  });
});

describe("buildGeoJSON", () => {
  it("should build complete GeoJSON FeatureCollection", () => {
    const incident: RawIncident = {
      ceo: "12345",
      typedist: "Планирано прекъсване",
      type_event: "1",
      city_name: "София",
      grid_id: "",
      cities: "",
      begin_event: "29.12.2025 10:00",
      end_event: "29.12.2025 16:00",
      lat: "42.6977",
      lon: "23.3219",
      points: { cnt: "0" },
    };

    const geoJson = buildGeoJSON(incident);

    expect(geoJson).toBeDefined();
    expect(geoJson?.type).toBe("FeatureCollection");
    expect(geoJson?.features).toHaveLength(1);

    const feature = geoJson?.features[0];
    expect(feature?.type).toBe("Feature");
    expect(feature?.geometry.type).toBe("Point");
    expect(feature?.properties.eventId).toBe("12345");
    expect(feature?.properties.cityName).toBe("София");
    expect(feature?.properties.eventType).toBe("Планирано прекъсване");
    expect(feature?.properties.startTime).toBe("29.12.2025 10:00");
    expect(feature?.properties.endTime).toBe("29.12.2025 16:00");
  });

  it("should parse dates to ISO format", () => {
    const incident: RawIncident = {
      ceo: "12345",
      typedist: "Авария",
      type_event: "1",
      city_name: "София",
      grid_id: "",
      cities: "",
      begin_event: "29.12.2025 10:00",
      end_event: "29.12.2025 16:00",
      lat: "42.6977",
      lon: "23.3219",
      points: { cnt: "0" },
    };

    const geoJson = buildGeoJSON(incident);
    const feature = geoJson?.features[0];

    expect(feature?.properties.startTimeISO).toBeDefined();
    expect(feature?.properties.endTimeISO).toBeDefined();
    expect(feature?.properties.startTimeISO).toContain("2025-12-29");
    expect(feature?.properties.endTimeISO).toContain("2025-12-29");
  });

  it("should handle invalid date formats gracefully", () => {
    const incident: RawIncident = {
      ceo: "12345",
      typedist: "Авария",
      type_event: "1",
      city_name: "София",
      grid_id: "",
      cities: "",
      begin_event: "invalid date",
      end_event: "also invalid",
      lat: "42.6977",
      lon: "23.3219",
      points: { cnt: "0" },
    };

    const geoJson = buildGeoJSON(incident);
    const feature = geoJson?.features[0];

    expect(feature?.properties.startTime).toBe("invalid date");
    expect(feature?.properties.endTime).toBe("also invalid");
    expect(feature?.properties.startTimeISO).toBeUndefined();
    expect(feature?.properties.endTimeISO).toBeUndefined();
  });

  it("should return null when geometry creation fails", () => {
    const incident: RawIncident = {
      ceo: "12345",
      typedist: "Авария",
      type_event: "1",
      city_name: "София",
      grid_id: "",
      cities: "",
      begin_event: "",
      end_event: "",
      lat: "invalid",
      lon: "invalid",
      points: { cnt: "0" },
    };

    const geoJson = buildGeoJSON(incident);

    expect(geoJson).toBeNull();
  });

  it("should include all properties in feature", () => {
    const incident: RawIncident = {
      ceo: "12345",
      typedist: "Авария",
      type_event: "1",
      city_name: "София",
      grid_id: "",
      cities: "",
      begin_event: "29.12.2025 10:00",
      end_event: "",
      lat: "42.6977",
      lon: "23.3219",
      points: { cnt: "0" },
    };

    const geoJson = buildGeoJSON(incident);
    const feature = geoJson?.features[0];

    expect(feature?.properties).toHaveProperty("eventId");
    expect(feature?.properties).toHaveProperty("cityName");
    expect(feature?.properties).toHaveProperty("eventType");
    expect(feature?.properties).toHaveProperty("startTime");
    expect(feature?.properties).toHaveProperty("endTime");
  });

  it("should create appropriate geometry based on customer points", () => {
    const incidentWithMultiPoint: RawIncident = {
      ceo: "12345",
      typedist: "Авария",
      type_event: "1",
      city_name: "София",
      grid_id: "",
      cities: "",
      begin_event: "",
      end_event: "",
      lat: "42.6977",
      lon: "23.3219",
      points: {
        cnt: "2",
        "1": { lat: "42.698", lon: "23.3225" },
        "2": { lat: "42.6975", lon: "23.321" },
      },
    };

    const geoJson = buildGeoJSON(incidentWithMultiPoint);
    expect(geoJson?.features[0].geometry.type).toBe("MultiPoint");
  });
});
