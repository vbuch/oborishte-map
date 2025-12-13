"use client";

import React from "react";
import { Marker, InfoWindow } from "@react-google-maps/api";
import { Message } from "@/lib/types";

interface AddressMarkersProps {
  readonly messages: Message[];
  readonly selectedMessage: {
    message: Message;
    addressIndex: number;
  } | null;
  readonly onMarkerClick: (message: Message, addressIndex: number) => void;
  readonly onInfoWindowClose: () => void;
}

export default function AddressMarkers({
  messages,
  selectedMessage,
  onMarkerClick,
  onInfoWindowClose,
}: AddressMarkersProps) {
  return (
    <>
      {/* Render traditional address markers */}
      {messages.map((message) =>
        message.addresses?.map((address, index) => (
          <Marker
            key={`${message.id}-${index}`}
            position={{
              lat: address.coordinates.lat,
              lng: address.coordinates.lng,
            }}
            onClick={() => onMarkerClick(message, index)}
          />
        ))
      )}

      {/* Info window for selected marker */}
      {selectedMessage?.message.addresses && (
        <InfoWindow
          position={{
            lat: selectedMessage.message.addresses[selectedMessage.addressIndex]
              .coordinates.lat,
            lng: selectedMessage.message.addresses[selectedMessage.addressIndex]
              .coordinates.lng,
          }}
          onCloseClick={onInfoWindowClose}
        >
          <div className="p-2 max-w-xs">
            <p className="text-sm font-semibold mb-2">Original Message:</p>
            <p className="text-sm mb-2">{selectedMessage.message.text}</p>
            <p className="text-xs text-gray-600">
              {
                selectedMessage.message.addresses[selectedMessage.addressIndex]
                  .formattedAddress
              }
            </p>
          </div>
        </InfoWindow>
      )}
    </>
  );
}
