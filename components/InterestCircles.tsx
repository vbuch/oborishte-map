"use client";

import { useMemo } from "react";
import { Circle } from "@react-google-maps/api";
import { Interest } from "@/lib/types";

interface InterestCirclesProps {
  readonly interests: Interest[];
  readonly onInterestClick: (interest: Interest) => void;
  readonly editingInterestId?: string | null;
  readonly hideAll?: boolean; // Hide all circles (e.g., during add mode)
}

// Blue color from Oborishte logo
const CIRCLE_COLOR = "#1976D2";
const CIRCLE_FILL_OPACITY = 0.15;
const CIRCLE_STROKE_OPACITY = 0.35;

// Shared circle options to avoid recreating on every render
const CIRCLE_OPTIONS = {
  fillColor: CIRCLE_COLOR,
  fillOpacity: CIRCLE_FILL_OPACITY,
  strokeColor: CIRCLE_COLOR,
  strokeOpacity: CIRCLE_STROKE_OPACITY,
  strokeWeight: 2,
  clickable: true,
  zIndex: 1,
};

export default function InterestCircles({
  interests,
  onInterestClick,
  editingInterestId,
  hideAll = false,
}: InterestCirclesProps) {
  console.log("[InterestCircles] RENDER:", {
    interestCount: interests.length,
    hideAll,
    editingInterestId,
    ids: interests.map((i) => i.id),
  });

  // Memoize the filtered circles to avoid recalculating on every render
  const circlesToRender = useMemo(() => {
    return interests
      .filter((interest) => interest.id !== editingInterestId)
      .filter(
        (interest, index, self) =>
          index === self.findIndex((i) => i.id === interest.id)
      );
  }, [interests, editingInterestId]);

  console.log(
    "[InterestCircles] Will render",
    circlesToRender.length,
    "circles"
  );
  circlesToRender.forEach((interest, idx) => {
    console.log(
      `[InterestCircles] Circle ${idx}:`,
      interest.id,
      interest.coordinates
    );
  });

  // Memoize the rendered circles
  const renderedCircles = useMemo(() => {
    console.log(
      "[InterestCircles] useMemo: Creating",
      circlesToRender.length,
      "circle elements"
    );
    return circlesToRender.map((interest) => {
      if (!interest.id) {
        console.warn("[InterestCircles] Interest without ID:", interest);
        return null;
      }

      console.log("[InterestCircles] Creating circle element:", interest.id);

      // Use a composite key to force remount if coordinates or radius change
      const compositeKey = `${interest.id}-${interest.coordinates.lat}-${interest.coordinates.lng}-${interest.radius}`;

      return (
        <Circle
          key={compositeKey}
          center={{
            lat: interest.coordinates.lat,
            lng: interest.coordinates.lng,
          }}
          radius={interest.radius}
          options={CIRCLE_OPTIONS}
          onClick={() => onInterestClick(interest)}
          onLoad={(circle) => {
            console.log(
              "[InterestCircles] Circle LOADED on map:",
              interest.id,
              circle
            );
          }}
          onUnmount={(circle) => {
            console.log(
              "[InterestCircles] Circle UNMOUNTED from map:",
              interest.id,
              circle
            );
          }}
        />
      );
    });
  }, [circlesToRender, onInterestClick]);

  // Don't render any circles if hideAll is true
  if (hideAll) {
    console.log("[InterestCircles] Hiding all circles (hideAll=true)");
    return null;
  }

  return <>{renderedCircles}</>;
}
