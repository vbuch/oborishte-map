"use client";

import React from "react";
import { Marker, Polyline, Polygon } from "@react-google-maps/api";
import { Message } from "@/lib/types";

interface GeoJSONLayerProps {
  readonly messages: Message[];
  readonly onFeatureClick?: (messageId: string) => void;
}

// Colors for different types of GeoJSON features
// Using the coral-red from the Oborishte logo instead of bright red
const LOGO_RED = "#E74C3C";

const GEOJSON_STYLES = {
  lineString: {
    strokeColor: LOGO_RED,
    strokeOpacity: 0.8,
    strokeWeight: 3,
    zIndex: 5,
  },
  lineStringHover: {
    strokeColor: LOGO_RED,
    strokeOpacity: 1,
    strokeWeight: 4,
    zIndex: 6,
  },
  polygon: {
    strokeColor: LOGO_RED,
    strokeOpacity: 0.8,
    strokeWeight: 2,
    fillColor: LOGO_RED,
    fillOpacity: 0.2,
    zIndex: 5,
  },
  polygonHover: {
    strokeColor: LOGO_RED,
    strokeOpacity: 1,
    strokeWeight: 3,
    fillColor: LOGO_RED,
    fillOpacity: 0.35,
    zIndex: 6,
  },
};

export default function GeoJSONLayer({
  messages,
  onFeatureClick,
}: GeoJSONLayerProps) {
  const features: React.ReactElement[] = [];
  const [hoveredFeature, setHoveredFeature] = React.useState<string | null>(
    null
  );

  console.log("GeoJSONLayer rendering with messages:", messages.length);

  messages.forEach((message) => {
    console.log("Processing message:", message.id, "geoJson:", message.geoJson);

    if (!message.geoJson?.features) {
      console.log("No geoJson features for message:", message.id);
      return;
    }

    console.log("Found", message.geoJson.features.length, "features");

    message.geoJson.features.forEach((feature, featureIndex) => {
      const key = `${message.id}-geojson-${featureIndex}`;

      console.log("Rendering feature:", {
        key,
        type: feature.geometry.type,
        properties: feature.properties,
        coordinates: feature.geometry.coordinates,
      });

      // Render based on geometry type
      if (feature.geometry.type === "Point") {
        const coords = feature.geometry.coordinates;
        console.log("Creating Point marker at:", {
          lat: coords[1],
          lng: coords[0],
        });

        features.push(
          <Marker
            key={key}
            position={{ lat: coords[1], lng: coords[0] }}
            icon={{
              path: "M 0,0 m -8,0 a 8,8 0 1,0 16,0 a 8,8 0 1,0 -16,0", // SVG circle path
              fillColor: LOGO_RED,
              fillOpacity: hoveredFeature === key ? 1 : 0.8,
              strokeWeight: 2,
              strokeColor: "#ffffff",
              scale: hoveredFeature === key ? 1.2 : 1,
            }}
            title={feature.properties?.address || "Pin"}
            zIndex={10}
            onClick={() => {
              console.log("GeoJSON point clicked:", feature.properties);
              if (message.id && onFeatureClick) {
                onFeatureClick(message.id);
              }
            }}
            onMouseOver={() => setHoveredFeature(key)}
            onMouseOut={() => setHoveredFeature(null)}
            options={{
              cursor: "pointer",
            }}
          />
        );
      } else if (feature.geometry.type === "LineString") {
        const path = feature.geometry.coordinates.map((coord) => ({
          lat: coord[1],
          lng: coord[0],
        }));
        const isHovered = hoveredFeature === key;
        features.push(
          <Polyline
            key={key}
            path={path}
            options={{
              ...(isHovered
                ? GEOJSON_STYLES.lineStringHover
                : GEOJSON_STYLES.lineString),
              clickable: true,
            }}
            onClick={() => {
              console.log("GeoJSON line clicked:", feature.properties);
              if (message.id && onFeatureClick) {
                onFeatureClick(message.id);
              }
            }}
            onMouseOver={() => setHoveredFeature(key)}
            onMouseOut={() => setHoveredFeature(null)}
          />
        );
      } else if (feature.geometry.type === "Polygon") {
        const paths = feature.geometry.coordinates[0].map((coord) => ({
          lat: coord[1],
          lng: coord[0],
        }));
        const isHovered = hoveredFeature === key;
        features.push(
          <Polygon
            key={key}
            paths={paths}
            options={{
              ...(isHovered
                ? GEOJSON_STYLES.polygonHover
                : GEOJSON_STYLES.polygon),
              clickable: true,
            }}
            onClick={() => {
              console.log("GeoJSON polygon clicked:", feature.properties);
              if (message.id && onFeatureClick) {
                onFeatureClick(message.id);
              }
            }}
            onMouseOver={() => setHoveredFeature(key)}
            onMouseOut={() => setHoveredFeature(null)}
          />
        );
      }
    });
  });

  return <>{features}</>;
}
