"use client";

import React, { useCallback, useRef } from "react";
import { GoogleMap } from "@react-google-maps/api";
import { Message, Interest } from "@/lib/types";
import GeoJSONLayer from "./GeoJSONLayer";
import InterestCircles from "./InterestCircles";
import InterestTargetMode from "./InterestTargetMode";

interface MapComponentProps {
  readonly messages: Message[];
  readonly onFeatureClick?: (messageId: string) => void;
  readonly onMapReady?: (
    centerMap: (lat: number, lng: number, zoom?: number) => void,
    mapInstance: google.maps.Map | null
  ) => void;
  readonly interests?: Interest[];
  readonly onInterestClick?: (interest: Interest) => void;
  readonly targetMode?: {
    active: boolean;
    initialRadius?: number;
    editingInterestId?: string | null;
    onSave: (coordinates: { lat: number; lng: number }, radius: number) => void;
    onCancel: () => void;
  };
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
  interests = [],
  onInterestClick,
  targetMode,
}: MapComponentProps) {
  const mapRef = useRef<google.maps.Map | null>(null);

  console.log("[MapComponent] RENDER:", {
    interestCount: interests.length,
    targetModeActive: targetMode?.active,
    editingId: targetMode?.editingInterestId,
    willRenderInterestCircles: interests.length > 0 && !!onInterestClick,
    willRenderTargetMode: !!targetMode?.active,
  });

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
      console.log("[MapComponent] onMapLoad called, map instance:", map);
      mapRef.current = map;
      // Notify parent that map is ready and pass the centerMap function and map instance
      if (onMapReady) {
        onMapReady(centerMap, map);
      }
    },
    [onMapReady, centerMap]
  );

  // Get dynamic map options based on target mode
  const getDynamicMapOptions = useCallback(() => {
    if (targetMode?.active) {
      return {
        ...mapOptions,
        zoomControl: false,
        scrollwheel: false,
        disableDoubleClickZoom: true,
        gestureHandling: "greedy",
      };
    }
    return mapOptions;
  }, [targetMode?.active]);

  return (
    <div className="absolute inset-0">
      {process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ? (
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          options={getDynamicMapOptions()}
          onLoad={onMapLoad}
        >
          <GeoJSONLayer messages={messages} onFeatureClick={onFeatureClick} />

          {/* Render interest circles when not in target mode or when editing existing */}
          {interests.length > 0 && onInterestClick && (
            <InterestCircles
              interests={interests}
              onInterestClick={onInterestClick}
              editingInterestId={targetMode?.editingInterestId}
              hideAll={targetMode?.active && !targetMode?.editingInterestId}
            />
          )}

          {/* Render target mode overlay when active */}
          {targetMode?.active && (
            <InterestTargetMode
              map={mapRef.current}
              initialRadius={targetMode.initialRadius}
              onSave={targetMode.onSave}
              onCancel={targetMode.onCancel}
            />
          )}
        </GoogleMap>
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gray-100">
          <p className="text-red-600">Google Maps API key is not configured</p>
        </div>
      )}
    </div>
  );
}
