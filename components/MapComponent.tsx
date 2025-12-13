"use client";

import React, { useState, useCallback, useRef } from "react";
import { GoogleMap, LoadScript } from "@react-google-maps/api";
import { Message } from "@/lib/types";
import AddressMarkers from "./AddressMarkers";
import GeoJSONLayer from "./GeoJSONLayer";

interface MapComponentProps {
  readonly messages: Message[];
}

// Oborishte District center coordinates
const OBORISHTE_CENTER = {
  lat: 42.6977,
  lng: 23.3341,
};

const mapContainerStyle = {
  width: "100%",
  height: "600px",
};

const mapOptions = {
  zoom: 15,
  center: OBORISHTE_CENTER,
  mapTypeControl: true,
  streetViewControl: true,
  fullscreenControl: true,
};

export default function MapComponent({ messages }: MapComponentProps) {
  const [selectedMessage, setSelectedMessage] = useState<{
    message: Message;
    addressIndex: number;
  } | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);

  const handleMarkerClick = useCallback(
    (message: Message, addressIndex: number) => {
      setSelectedMessage({ message, addressIndex });
    },
    []
  );

  const handleInfoWindowClose = useCallback(() => {
    setSelectedMessage(null);
  }, []);

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  return (
    <LoadScript
      googleMapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ""}
    >
      {process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ? (
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          options={mapOptions}
          onLoad={onMapLoad}
        >
          <AddressMarkers
            messages={messages}
            selectedMessage={selectedMessage}
            onMarkerClick={handleMarkerClick}
            onInfoWindowClose={handleInfoWindowClose}
          />
          <GeoJSONLayer messages={messages} />
        </GoogleMap>
      ) : (
        <div className="w-full h-[600px] flex items-center justify-center bg-gray-100 rounded-lg">
          <p className="text-red-600">Google Maps API key is not configured</p>
        </div>
      )}
    </LoadScript>
  );
}
