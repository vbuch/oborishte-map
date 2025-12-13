"use client";

import React from "react";
import { Marker, Polyline, Polygon } from "@react-google-maps/api";
import { Message } from "@/lib/types";

interface GeoJSONLayerProps {
  readonly messages: Message[];
}

// Colors for different types of GeoJSON features
const GEOJSON_STYLES = {
  lineString: {
    strokeColor: "#FF0000",
    strokeOpacity: 0.8,
    strokeWeight: 3,
  },
  polygon: {
    strokeColor: "#0000FF",
    strokeOpacity: 0.8,
    strokeWeight: 2,
    fillColor: "#0000FF",
    fillOpacity: 0.2,
  },
};

export default function GeoJSONLayer({ messages }: GeoJSONLayerProps) {
  const features: React.ReactElement[] = [];

  messages.forEach((message) => {
    if (!message.geoJson?.features) return;

    message.geoJson.features.forEach((feature, featureIndex) => {
      const key = `${message.id}-geojson-${featureIndex}`;

      // Render based on geometry type
      if (feature.geometry.type === "Point") {
        const coords = feature.geometry.coordinates;
        features.push(
          <Marker
            key={key}
            position={{ lat: coords[1], lng: coords[0] }}
            icon={{
              path: google.maps.SymbolPath.CIRCLE,
              scale: 8,
              fillColor: "#4CAF50",
              fillOpacity: 0.8,
              strokeWeight: 2,
              strokeColor: "#ffffff",
            }}
            onClick={() => {
              console.log("GeoJSON point clicked:", feature.properties);
            }}
          />
        );
      } else if (feature.geometry.type === "LineString") {
        const path = feature.geometry.coordinates.map((coord) => ({
          lat: coord[1],
          lng: coord[0],
        }));
        features.push(
          <Polyline key={key} path={path} options={GEOJSON_STYLES.lineString} />
        );
      } else if (feature.geometry.type === "Polygon") {
        const paths = feature.geometry.coordinates[0].map((coord) => ({
          lat: coord[1],
          lng: coord[0],
        }));
        features.push(
          <Polygon key={key} paths={paths} options={GEOJSON_STYLES.polygon} />
        );
      }
    });
  });

  return <>{features}</>;
}
