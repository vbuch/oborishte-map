import MapComponent from "@/components/MapComponent";
import AddInterestButton from "@/components/AddInterestButton";
import AddInterestsPrompt from "@/components/AddInterestsPrompt";
import { Message, Interest } from "@/lib/types";

interface MapContainerProps {
  readonly messages: Message[];
  readonly interests: Interest[];
  readonly user: any;
  readonly targetMode: {
    active: boolean;
    initialRadius?: number;
    editingInterestId?: string | null;
  };
  readonly initialMapCenter?: { lat: number; lng: number } | null;
  readonly onFeatureClick: (messageId: string) => void;
  readonly onMapReady: (
    centerMap: (
      lat: number,
      lng: number,
      zoom?: number,
      options?: { animate?: boolean }
    ) => void,
    mapInstance: google.maps.Map | null
  ) => void;
  readonly onInterestClick: (interest: Interest) => void;
  readonly onSaveInterest: (
    coordinates: { lat: number; lng: number },
    radius: number
  ) => void;
  readonly onCancelTargetMode: () => void;
  readonly onStartAddInterest: () => void;
}

export default function MapContainer({
  messages,
  interests,
  user,
  targetMode,
  initialMapCenter,
  onFeatureClick,
  onMapReady,
  onInterestClick,
  onSaveInterest,
  onCancelTargetMode,
  onStartAddInterest,
}: MapContainerProps) {
  return (
    <div className="absolute inset-0">
      <MapComponent
        messages={messages}
        onFeatureClick={onFeatureClick}
        onMapReady={onMapReady}
        interests={interests}
        onInterestClick={onInterestClick}
        initialCenter={initialMapCenter || undefined}
        targetMode={
          targetMode.active
            ? {
                active: true,
                initialRadius: targetMode.initialRadius,
                editingInterestId: targetMode.editingInterestId,
                onSave: onSaveInterest,
                onCancel: onCancelTargetMode,
              }
            : undefined
        }
      />

      {/* Add interests prompt - shown when user is logged in but has no interests */}
      {user && interests.length === 0 && (
        <AddInterestsPrompt onAddInterests={onStartAddInterest} />
      )}

      {/* Add interests button - shown when user is logged in and has interests */}
      {user && interests.length > 0 && (
        <AddInterestButton
          onClick={onStartAddInterest}
          isUserAuthenticated={!!user}
          visible={!targetMode.active}
        />
      )}
    </div>
  );
}
