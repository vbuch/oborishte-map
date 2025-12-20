"use client";

import React, { useCallback, useMemo, useRef } from "react";
import { GoogleMap } from "@react-google-maps/api";
import { Message, Interest } from "@/lib/types";
import GeoJSONLayer from "./GeoJSONLayer";
import InterestCircles from "./InterestCircles";
import InterestTargetMode from "./InterestTargetMode";

interface MapComponentProps {
  readonly messages: Message[];
  readonly onFeatureClick?: (messageId: string) => void;
  readonly onMapReady?: (
    centerMap: (
      lat: number,
      lng: number,
      zoom?: number,
      options?: { animate?: boolean }
    ) => void,
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
  const latestCenterRef = useRef(OBORISHTE_CENTER);

  const centerMap = useCallback(
    (
      lat: number,
      lng: number,
      zoom: number = 17,
      options?: { animate?: boolean }
    ) => {
      if (!mapRef.current) {
        return;
      }

      const nextCenter = { lat, lng };
      latestCenterRef.current = nextCenter;

      if (options?.animate === false) {
        mapRef.current.setCenter(nextCenter);
      } else {
        mapRef.current.panTo(nextCenter);
      }

      mapRef.current.setZoom(zoom);
    },
    []
  );

  const onMapLoad = useCallback(
    (map: google.maps.Map) => {
      mapRef.current = map;
      // Notify parent that map is ready and pass the centerMap function and map instance
      if (onMapReady) {
        onMapReady(centerMap, map);
      }
    },
    [onMapReady, centerMap]
  );

  // Get dynamic map options based on target mode
  const dynamicMapOptions = useMemo(() => {
    const currentMapCenter = mapRef.current?.getCenter();
    const preservedCenter = currentMapCenter
      ? {
          lat: currentMapCenter.lat(),
          lng: currentMapCenter.lng(),
        }
      : latestCenterRef.current;

    const baseOptions = {
      ...mapOptions,
      center: preservedCenter,
    } as const;

    if (targetMode?.active) {
      return {
        ...baseOptions,
        zoomControl: false,
        scrollwheel: false,
        disableDoubleClickZoom: true,
        gestureHandling: "greedy" as google.maps.MapOptions["gestureHandling"],
      };
    }

    return baseOptions;
  }, [targetMode?.active]);

  const handleCenterChanged = useCallback(() => {
    if (!mapRef.current) return;
    const center = mapRef.current.getCenter();
    if (!center) return;
    latestCenterRef.current = {
      lat: center.lat(),
      lng: center.lng(),
    };
  }, []);

  return (
    <div className="absolute inset-0">
      {process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ? (
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          options={dynamicMapOptions}
          onLoad={onMapLoad}
          onCenterChanged={handleCenterChanged}
        >
          <GeoJSONLayer messages={messages} onFeatureClick={onFeatureClick} />

          {/* Render interest circles when not in target mode or when editing existing */}
          {interests.length > 0 && onInterestClick && (
            <InterestCircles
              interests={interests}
              onInterestClick={onInterestClick}
              editingInterestId={targetMode?.editingInterestId}
              hideAll={false}
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
          <p className="text-red-600">Няма настроен ключ за Google Maps API</p>
        </div>
      )}
    </div>
  );
}
