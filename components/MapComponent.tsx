"use client";

import React, { useCallback, useRef } from "react";
import { GoogleMap, LoadScript } from "@react-google-maps/api";
import { Message } from "@/lib/types";
import GeoJSONLayer from "./GeoJSONLayer";

interface MapComponentProps {
  readonly messages: Message[];
  readonly onFeatureClick?: (messageId: string) => void;
  readonly onMapReady?: (
    centerMap: (lat: number, lng: number, zoom?: number) => void
  ) => void;
}

// Oborishte District center coordinates
const OBORISHTE_CENTER = {
  lat: 42.6977,
  lng: 23.3341,
};

const mapContainerStyle = {
  width: "100%",
  height: "100%",
};

// Desaturated map style
const mapStyles = [
  {
    elementType: "geometry",
    stylers: [{ saturation: -60 }],
  },
  {
    elementType: "labels.text.fill",
    stylers: [{ saturation: -40 }, { lightness: 10 }],
  },
  {
    elementType: "labels.text.stroke",
    stylers: [{ visibility: "on" }, { saturation: -100 }, { lightness: 60 }],
  },
  {
    featureType: "poi",
    elementType: "geometry",
    stylers: [{ saturation: -100 }, { lightness: 40 }],
  },
  {
    featureType: "poi",
    elementType: "labels.icon",
    stylers: [{ saturation: -100 }, { lightness: 20 }],
  },
  {
    featureType: "poi",
    elementType: "labels.text.fill",
    stylers: [{ saturation: -100 }, { lightness: 20 }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ saturation: -60 }, { lightness: 20 }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ saturation: -40 }, { lightness: 30 }],
  },
];

const mapOptions = {
  zoom: 15,
  center: OBORISHTE_CENTER,
  mapTypeControl: true,
  streetViewControl: true,
  fullscreenControl: true,
  styles: mapStyles,
  clickableIcons: false, // Disable clicking on POIs (shops, hospitals, etc.)
};

export default function MapComponent({
  messages,
  onFeatureClick,
  onMapReady,
}: MapComponentProps) {
  const mapRef = useRef<google.maps.Map | null>(null);

  const centerMap = useCallback(
    (lat: number, lng: number, zoom: number = 17) => {
      if (mapRef.current) {
        mapRef.current.panTo({ lat, lng });
        mapRef.current.setZoom(zoom);
      }
    },
    []
  );

  const onMapLoad = useCallback(
    (map: google.maps.Map) => {
      mapRef.current = map;
      // Notify parent that map is ready and pass the centerMap function
      if (onMapReady) {
        onMapReady(centerMap);
      }
    },
    [onMapReady, centerMap]
  );

  return (
    <div className="absolute inset-0">
      <LoadScript
        googleMapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ""}
      >
        {process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ? (
          <GoogleMap
            mapContainerStyle={mapContainerStyle}
            options={mapOptions}
            onLoad={onMapLoad}
          >
            <GeoJSONLayer messages={messages} onFeatureClick={onFeatureClick} />
          </GoogleMap>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-100">
            <p className="text-red-600">
              Google Maps API key is not configured
            </p>
          </div>
        )}
      </LoadScript>
    </div>
  );
}
