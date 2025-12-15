"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import MapComponent from "@/components/MapComponent";
import MessageDetailView from "@/components/MessageDetailView";
import { Message } from "@/lib/types";

export default function HomeContent() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mapHeight, setMapHeight] = useState<number>(600);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

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
          />
        )}
      </div>

      {/* Message Detail View */}
      <MessageDetailView
        message={selectedMessage}
        onClose={handleCloseDetail}
      />
    </div>
  );
}
