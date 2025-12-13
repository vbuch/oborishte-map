export interface Message {
  id?: string;
  text: string;
  addresses?: Address[];
  extractedData?: ExtractedData;
  geoJson?: GeoJSONFeatureCollection;
  createdAt: Date | string;
}

export interface Address {
  originalText: string;
  formattedAddress: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  geoJson?: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
  };
}

export interface StreetSection {
  street: string;
  from: string;
  to: string;
}

export interface Timespan {
  start: string;
  end: string;
}

export interface ExtractedData {
  responsible_entity: string;
  pins: string[];
  streets: StreetSection[];
  timespan: Timespan[];
}

// GeoJSON Types
export type GeoJSONGeometry = GeoJSONPoint | GeoJSONLineString | GeoJSONPolygon;

export interface GeoJSONPoint {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
}

export interface GeoJSONLineString {
  type: 'LineString';
  coordinates: [number, number][]; // array of [longitude, latitude]
}

export interface GeoJSONPolygon {
  type: 'Polygon';
  coordinates: [number, number][][]; // array of rings, each ring is array of [longitude, latitude]
}

export interface GeoJSONFeature {
  type: 'Feature';
  geometry: GeoJSONGeometry;
  properties: Record<string, any>;
}

export interface GeoJSONFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}

// Intersection coordinates
export interface IntersectionCoordinates {
  lat: number;
  lng: number;
}
