'use client';

import React, { useState, useCallback } from 'react';
import { GoogleMap, LoadScript, Marker, InfoWindow } from '@react-google-maps/api';
import { Message } from '@/lib/types';

interface MapComponentProps {
  messages: Message[];
}

// Oborishte District center coordinates
const OBORISHTE_CENTER = {
  lat: 42.6977,
  lng: 23.3341,
};

const mapContainerStyle = {
  width: '100%',
  height: '600px',
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

  const handleMarkerClick = useCallback((message: Message, addressIndex: number) => {
    setSelectedMessage({ message, addressIndex });
  }, []);

  const handleInfoWindowClose = useCallback(() => {
    setSelectedMessage(null);
  }, []);

  return (
    <LoadScript googleMapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}>
      {!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ? (
        <div className="w-full h-[600px] flex items-center justify-center bg-gray-100 rounded-lg">
          <p className="text-red-600">Google Maps API key is not configured</p>
        </div>
      ) : (
        <GoogleMap mapContainerStyle={mapContainerStyle} options={mapOptions}>
          {messages.map((message) =>
            message.addresses?.map((address, index) => (
              <Marker
                key={`${message.id}-${index}`}
                position={{
                  lat: address.coordinates.lat,
                  lng: address.coordinates.lng,
                }}
                onClick={() => handleMarkerClick(message, index)}
              />
            ))
          )}

          {selectedMessage && (
            <InfoWindow
              position={{
                lat: selectedMessage.message.addresses![selectedMessage.addressIndex].coordinates.lat,
                lng: selectedMessage.message.addresses![selectedMessage.addressIndex].coordinates.lng,
              }}
              onCloseClick={handleInfoWindowClose}
            >
              <div className="p-2 max-w-xs">
                <p className="text-sm font-semibold mb-2">Original Message:</p>
                <p className="text-sm mb-2">{selectedMessage.message.text}</p>
                <p className="text-xs text-gray-600">
                  {selectedMessage.message.addresses![selectedMessage.addressIndex].formattedAddress}
                </p>
              </div>
            </InfoWindow>
          )}
        </GoogleMap>
      )}
    </LoadScript>
  );
}
