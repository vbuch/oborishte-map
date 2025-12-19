"use client";

import { useMemo, useState } from "react";
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
const CIRCLE_FILL_OPACITY = 0.08;
const CIRCLE_STROKE_OPACITY = 0.1;
const OPACITY_HOVER_DELTA = 0.05;
const CIRCLE_FILL_OPACITY_HOVER = Math.max(
  CIRCLE_FILL_OPACITY - OPACITY_HOVER_DELTA,
  0
);
const CIRCLE_STROKE_OPACITY_HOVER = Math.max(
  CIRCLE_STROKE_OPACITY - OPACITY_HOVER_DELTA,
  0
);

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
  const [hoveredInterestId, setHoveredInterestId] = useState<string | null>(
    null
  );
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

      const isHovered = hoveredInterestId === interest.id;

      return (
        <Circle
          key={compositeKey}
          center={{
            lat: interest.coordinates.lat,
            lng: interest.coordinates.lng,
          }}
          radius={interest.radius}
          options={{
            ...CIRCLE_OPTIONS,
            fillOpacity: isHovered
              ? CIRCLE_FILL_OPACITY_HOVER
              : CIRCLE_FILL_OPACITY,
            strokeOpacity: isHovered
              ? CIRCLE_STROKE_OPACITY_HOVER
              : CIRCLE_STROKE_OPACITY,
          }}
          onClick={() => onInterestClick(interest)}
          onMouseOver={() => setHoveredInterestId(interest.id ?? null)}
          onMouseOut={() => {
            if (hoveredInterestId === interest.id) {
              setHoveredInterestId(null);
            }
          }}
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
  }, [circlesToRender, onInterestClick, hoveredInterestId]);

  // Don't render any circles if hideAll is true
  if (hideAll) {
    console.log("[InterestCircles] Hiding all circles (hideAll=true)");
    return null;
  }

  return <>{renderedCircles}</>;
}
