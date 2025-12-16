"use client";

import React, { useState, useEffect } from "react";
import { Circle } from "@react-google-maps/api";

interface InterestTargetModeProps {
  readonly map: google.maps.Map | null;
  readonly initialRadius?: number;
  readonly onSave: (
    coordinates: { lat: number; lng: number },
    radius: number
  ) => void;
  readonly onCancel: () => void;
}

// Blue color from Oborishte logo
const CIRCLE_COLOR = "#1976D2";
const CIRCLE_OPACITY = 0.15;

// Radius constraints
const MIN_RADIUS = 100;
const MAX_RADIUS = 1000;
const DEFAULT_RADIUS = 500;

export default function InterestTargetMode({
  map,
  initialRadius = DEFAULT_RADIUS,
  onSave,
  onCancel,
}: InterestTargetModeProps) {
  const [currentCenter, setCurrentCenter] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [radius, setRadius] = useState(initialRadius);
  const [isSaving, setIsSaving] = useState(false);

  console.log("[InterestTargetMode] RENDER:", {
    hasMap: !!map,
    radius,
    currentCenter,
  });

  // Update center when map moves
  useEffect(() => {
    if (!map) return;

    const updateCenter = () => {
      const center = map.getCenter();
      if (center) {
        setCurrentCenter({
          lat: center.lat(),
          lng: center.lng(),
        });
      }
    };

    // Set initial center
    updateCenter();

    // Update center on map movement
    const listener = map.addListener("center_changed", updateCenter);

    return () => {
      google.maps.event.removeListener(listener);
    };
  }, [map]);

  const handleSave = async () => {
    if (!currentCenter) return;

    setIsSaving(true);
    try {
      onSave(currentCenter, radius);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRadiusChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(event.target.value);
    setRadius(value);
  };

  return (
    <>
      {/* Preview Circle */}
      {currentCenter && (
        <Circle
          center={currentCenter}
          radius={radius}
          options={{
            fillColor: CIRCLE_COLOR,
            fillOpacity: CIRCLE_OPACITY,
            strokeColor: CIRCLE_COLOR,
            strokeOpacity: CIRCLE_OPACITY * 2,
            strokeWeight: 2,
            clickable: false,
            zIndex: 10,
          }}
        />
      )}

      {/* Crosshair Overlay */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-20">
        <div className="relative">
          {/* Horizontal line */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-0.5 bg-red-500 shadow-lg"></div>
          {/* Vertical line */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-12 bg-red-500 shadow-lg"></div>
          {/* Center dot */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-red-500 rounded-full shadow-lg"></div>
        </div>
      </div>

      {/* Control Panel */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30 pointer-events-auto">
        <div className="bg-white rounded-lg shadow-xl border border-gray-200 p-4 min-w-[320px]">
          {/* Coordinates Display */}
          {currentCenter && (
            <div className="mb-4 text-xs text-gray-600 font-mono text-center">
              {currentCenter.lat.toFixed(6)}, {currentCenter.lng.toFixed(6)}
            </div>
          )}

          {/* Radius Slider */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Radius: {radius}m
            </label>
            <input
              type="range"
              min={MIN_RADIUS}
              max={MAX_RADIUS}
              step={50}
              value={radius}
              onChange={handleRadiusChange}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>{MIN_RADIUS}m</span>
              <span>{MAX_RADIUS}m</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={onCancel}
              disabled={isSaving}
              className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!currentCenter || isSaving}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? "Saving..." : "Save Location"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
