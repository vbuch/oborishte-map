import { describe, expect, it } from "vitest";
import type { RawIncident } from "./types";
import { createGeometry } from "./geometry";

describe("createGeometry", () => {
  it("should create Point geometry when no customer points", () => {
    const incident: RawIncident = {
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
      points: { cnt: "0" },
    };

    const geometry = createGeometry(incident);

    expect(geometry).toEqual({
      type: "Point",
      coordinates: [23.3219, 42.6977],
    });
  });

  it("should create MultiPoint geometry for 1 customer point", () => {
    const incident: RawIncident = {
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
        cnt: "1",
        "1": { lat: "42.698", lon: "23.3225" },
      },
    };

    const geometry = createGeometry(incident);

    expect(geometry?.type).toBe("MultiPoint");
    if (geometry?.type === "MultiPoint") {
      expect(geometry.coordinates).toHaveLength(1);
      expect(geometry.coordinates[0]).toEqual([23.3225, 42.698]);
    }
  });

  it("should create MultiPoint geometry for 2 customer points", () => {
    const incident: RawIncident = {
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

    const geometry = createGeometry(incident);

    expect(geometry?.type).toBe("MultiPoint");
    if (geometry?.type === "MultiPoint") {
      expect(geometry.coordinates).toHaveLength(2);
      expect(geometry.coordinates[0]).toEqual([23.3225, 42.698]);
      expect(geometry.coordinates[1]).toEqual([23.321, 42.6975]);
    }
  });

  it("should create Polygon geometry for 3+ customer points", () => {
    const incident: RawIncident = {
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
        cnt: "4",
        "1": { lat: "42.698", lon: "23.322" },
        "2": { lat: "42.698", lon: "23.323" },
        "3": { lat: "42.697", lon: "23.323" },
        "4": { lat: "42.697", lon: "23.322" },
      },
    };

    const geometry = createGeometry(incident);

    expect(geometry?.type).toBe("Polygon");
    if (geometry?.type === "Polygon") {
      expect(geometry.coordinates).toBeDefined();
      expect(geometry.coordinates[0].length).toBeGreaterThan(3); // At least 4 points (including closing point)
    }
  });

  it("should return null for invalid center coordinates", () => {
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
      lon: "23.3219",
      points: { cnt: "0" },
    };

    const geometry = createGeometry(incident);

    expect(geometry).toBeNull();
  });

  it("should create Polygon even for collinear points", () => {
    const incident: RawIncident = {
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
        cnt: "3",
        // Three points on a line - turf will still create a polygon
        "1": { lat: "42.697", lon: "23.321" },
        "2": { lat: "42.6975", lon: "23.3215" },
        "3": { lat: "42.698", lon: "23.322" },
      },
    };

    const geometry = createGeometry(incident);

    // Turf creates a degenerate polygon (line) for collinear points
    expect(geometry?.type).toBe("Polygon");
  });

  it("should handle missing lat/lon gracefully", () => {
    const incident: RawIncident = {
      ceo: "12345",
      typedist: "Авария",
      type_event: "1",
      city_name: "София",
      grid_id: "",
      cities: "",
      begin_event: "",
      end_event: "",
      lat: "",
      lon: "",
      points: { cnt: "0" },
    };

    const geometry = createGeometry(incident);

    expect(geometry).toBeNull();
  });
});
