"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import MapComponent from "@/components/MapComponent";
import MessageDetailView from "@/components/MessageDetailView";
import NotificationPrompt from "@/components/NotificationPrompt";
import LoginPrompt from "@/components/LoginPrompt";
import { Message, Interest } from "@/lib/types";
import { useInterests } from "@/lib/hooks/useInterests";
import { useNotificationPrompt } from "@/lib/hooks/useNotificationPrompt";
import { useAuth } from "@/lib/auth-context";

interface HomeContentProps {
  readonly onAddInterestRequest?: () => void;
}

export default function HomeContent({
  onAddInterestRequest,
}: HomeContentProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mapHeight, setMapHeight] = useState<number>(600);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [centerMapFn, setCenterMapFn] = useState<
    | ((
        lat: number,
        lng: number,
        zoom?: number,
        options?: { animate?: boolean }
      ) => void)
    | null
  >(null);

  // Interest management state
  const [targetMode, setTargetMode] = useState<{
    active: boolean;
    initialRadius?: number;
    editingInterestId?: string | null;
  }>({ active: false });
  const [selectedInterest, setSelectedInterest] = useState<Interest | null>(
    null
  );
  const [interestMenuPosition, setInterestMenuPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const { interests, addInterest, updateInterest, deleteInterest } =
    useInterests();

  const { user } = useAuth();
  const { showPrompt, onAccept, onDecline, checkAndPromptForNotifications } =
    useNotificationPrompt();

  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Check for notification permission when user has circles
  useEffect(() => {
    if (user && interests.length > 0) {
      user
        .getIdToken()
        .then((idToken) => {
          checkAndPromptForNotifications(user.uid, idToken, true);
        })
        .catch((err) => {
          console.error("Failed to check notification permissions:", err);
        });
    }
  }, [user, interests.length, checkAndPromptForNotifications]);

  // Calculate map height based on viewport
  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        const height = containerRef.current.clientHeight;
        setMapHeight(height);
      }
    };

    updateHeight();
    globalThis.addEventListener("resize", updateHeight);

    return () => {
      globalThis.removeEventListener("resize", updateHeight);
    };
  }, []);

  const fetchMessages = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch("/api/messages");

      if (!response.ok) {
        throw new Error("Failed to fetch messages");
      }

      const data = await response.json();
      setMessages(data.messages || []);
    } catch (err) {
      setError("Failed to load messages. Please refresh the page.");
      console.error("Error fetching messages:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Handle feature click - update URL and select message
  const handleFeatureClick = useCallback(
    (messageId: string) => {
      const message = messages.find((m) => m.id === messageId);
      if (message) {
        setSelectedMessage(message);
        // Update URL with query parameter
        router.push(`/?messageId=${messageId}`, { scroll: false });
      }
    },
    [messages, router]
  );

  // Handle closing detail view
  const handleCloseDetail = useCallback(() => {
    setSelectedMessage(null);
    // Remove query parameter from URL
    router.push("/", { scroll: false });
  }, [router]);

  // Handle map ready - receive centerMap function and map instance
  const handleMapReady = useCallback(
    (
      centerMap: (
        lat: number,
        lng: number,
        zoom?: number,
        options?: { animate?: boolean }
      ) => void,
      _map: google.maps.Map | null
    ) => {
      setCenterMapFn(() => centerMap);
    },
    []
  );

  // Handle address click - center map on coordinates
  const handleAddressClick = useCallback(
    (lat: number, lng: number) => {
      if (centerMapFn) {
        centerMapFn(lat, lng, 18);
      }
    },
    [centerMapFn]
  );

  // Sync selected message with URL parameter
  useEffect(() => {
    const messageId = searchParams.get("messageId");
    if (messageId && messages.length > 0) {
      const message = messages.find((m) => m.id === messageId);
      if (message) {
        setSelectedMessage(message);
      } else {
        // Message not found, clear the parameter
        setSelectedMessage(null);
      }
    } else if (!messageId && selectedMessage) {
      // URL was changed (e.g., back button) without messageId
      setSelectedMessage(null);
    }
  }, [searchParams, messages, selectedMessage]);

  useEffect(() => {
    fetchMessages();

    // Listen for message submission events
    const handleMessageSubmitted = () => {
      setTimeout(() => {
        fetchMessages();
      }, 2000);
    };

    globalThis.addEventListener("messageSubmitted", handleMessageSubmitted);

    return () => {
      globalThis.removeEventListener(
        "messageSubmitted",
        handleMessageSubmitted
      );
    };
  }, [fetchMessages]);

  // Interest management handlers
  const handleInterestClick = useCallback((interest: Interest) => {
    setSelectedInterest(interest);
    // Show context menu at cursor position
    // For simplicity, we'll use a fixed position relative to viewport
    setInterestMenuPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    });
  }, []);

  const handleMoveInterest = useCallback(() => {
    if (!selectedInterest || !centerMapFn) return;

    // Center map on the interest
    centerMapFn(
      selectedInterest.coordinates.lat,
      selectedInterest.coordinates.lng,
      17,
      { animate: false }
    );

    // Enter target mode with the interest being edited
    setTargetMode({
      active: true,
      initialRadius: selectedInterest.radius,
      editingInterestId: selectedInterest.id,
    });

    // Close menu
    setInterestMenuPosition(null);
    setSelectedInterest(null);
  }, [selectedInterest, centerMapFn]);

  const handleDeleteInterest = useCallback(async () => {
    if (!selectedInterest?.id) return;

    try {
      await deleteInterest(selectedInterest.id);
      setInterestMenuPosition(null);
      setSelectedInterest(null);
    } catch (error) {
      console.error("Failed to delete interest:", error);

      // Check if it's a 404 (already deleted, likely a duplicate)
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      if (errorMessage.includes("404")) {
        console.warn(
          "Interest already deleted (likely a duplicate), removing from local state"
        );
        setInterestMenuPosition(null);
        setSelectedInterest(null);
        // Refresh to sync state
        globalThis.location.reload();
      } else {
        alert("Failed to delete interest. Please try again.");
      }
    }
  }, [selectedInterest, deleteInterest]);

  const handleStartAddInterest = useCallback(() => {
    setTargetMode({
      active: true,
      initialRadius: 500,
      editingInterestId: null,
    });

    // Notify parent if callback provided
    if (onAddInterestRequest) {
      onAddInterestRequest();
    }
  }, [onAddInterestRequest]);

  const handleSaveInterest = useCallback(
    (coordinates: { lat: number; lng: number }, radius: number) => {
      (async () => {
        try {
          if (targetMode.editingInterestId) {
            // Update existing interest
            await updateInterest(targetMode.editingInterestId, {
              coordinates,
              radius,
            });
          } else {
            // Add new interest
            await addInterest(coordinates, radius);
          }

          // Exit target mode
          setTargetMode({ active: false });
        } catch (error) {
          console.error("Failed to save interest:", error);
          alert("Failed to save interest. Please try again.");
        }
      })();
    },
    [targetMode.editingInterestId, addInterest, updateInterest]
  );

  const handleCancelTargetMode = useCallback(() => {
    setTargetMode({ active: false });
  }, []);

  const handleCloseInterestMenu = useCallback(() => {
    setInterestMenuPosition(null);
    setSelectedInterest(null);
  }, []);

  // Expose handleStartAddInterest to parent via effect
  useEffect(() => {
    // Store in global for Header to access
    (globalThis as any).__startAddInterest = handleStartAddInterest;
    return () => {
      delete (globalThis as any).__startAddInterest;
    };
  }, [handleStartAddInterest]);

  return (
    <div className="flex-1 flex flex-col" ref={containerRef}>
      {/* Error message if any */}
      {error && (
        <div className="bg-white border-b shadow-sm z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="p-4 bg-red-100 text-red-700 rounded-md">
              {error}
            </div>
          </div>
        </div>
      )}

      {/* Map - Takes all available space */}
      <div className="flex-1 relative" style={{ minHeight: `${mapHeight}px` }}>
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
            <p className="text-gray-600">Loading map...</p>
          </div>
        ) : (
          <MapComponent
            messages={messages}
            onFeatureClick={handleFeatureClick}
            onMapReady={handleMapReady}
            interests={interests}
            onInterestClick={handleInterestClick}
            targetMode={
              targetMode.active
                ? {
                    active: true,
                    initialRadius: targetMode.initialRadius,
                    editingInterestId: targetMode.editingInterestId,
                    onSave: handleSaveInterest,
                    onCancel: handleCancelTargetMode,
                  }
                : undefined
            }
          />
        )}
      </div>

      {/* Message Detail View */}
      <MessageDetailView
        message={selectedMessage}
        onClose={handleCloseDetail}
        onAddressClick={handleAddressClick}
      />

      {/* Interest Context Menu */}
      {interestMenuPosition && selectedInterest && (
        <>
          {/* Backdrop to close menu */}
          <button
            type="button"
            className="fixed inset-0 z-40 bg-transparent cursor-default"
            onClick={handleCloseInterestMenu}
            aria-label="Close menu"
          />
          {/* Menu */}
          <div
            className="fixed z-50 bg-white rounded-lg shadow-xl border border-gray-200 py-1 min-w-[150px]"
            style={{
              left: `${interestMenuPosition.x}px`,
              top: `${interestMenuPosition.y}px`,
              transform: "translate(-50%, -50%)",
            }}
          >
            <button
              onClick={handleMoveInterest}
              className="w-full px-4 py-2 text-sm text-left text-gray-700 hover:bg-gray-100 flex items-center gap-2"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"></path>
              </svg>
              Move
            </button>
            <button
              onClick={handleDeleteInterest}
              className="w-full px-4 py-2 text-sm text-left text-red-600 hover:bg-red-50 flex items-center gap-2"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
              </svg>
              Delete
            </button>
          </div>
        </>
      )}

      {/* Notification permission prompt */}
      {showPrompt && (
        <NotificationPrompt onAccept={onAccept} onDecline={onDecline} />
      )}

      {/* Login prompt for non-authenticated users */}
      {!user && <LoginPrompt />}
    </div>
  );
}
