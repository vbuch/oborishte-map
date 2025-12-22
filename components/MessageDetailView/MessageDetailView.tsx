"use client";

import React, { useEffect, useState } from "react";
import { Message } from "@/lib/types";
import { useDragToClose } from "@/lib/hooks/useDragToClose";
import Header from "./Header";
import SourceDisplay from "./Source";
import Locations from "./Locations";
import Addresses from "./Addresses";

interface MessageDetailViewProps {
  readonly message: Message | null;
  readonly onClose: () => void;
  readonly onAddressClick?: (lat: number, lng: number) => void;
}

export default function MessageDetailView({
  message,
  onClose,
  onAddressClick,
}: Readonly<MessageDetailViewProps>) {
  const [isVisible, setIsVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  // Drag to close functionality
  const { isDragging, dragOffset, handlers } = useDragToClose({ onClose });

  // Handle animation states
  useEffect(() => {
    if (message) {
      setShouldRender(true);
      requestAnimationFrame(() => setIsVisible(true));
    } else {
      setIsVisible(false);
      const timer = setTimeout(() => setShouldRender(false), 300);
      return () => clearTimeout(timer);
    }
  }, [message]);

  // Close on ESC key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && message) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [message, onClose]);

  if (!shouldRender) return null;
  if (!message) return null;

  const formatDate = (date: Date | string) => {
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleDateString("bg-BG", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <>
      <div
        className={`fixed inset-0 z-30 bg-black/20 backdrop-blur-sm transition-opacity duration-300 ${
          isVisible ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        aria-label="Детайли за сигнала"
        className={`fixed z-40 bg-white shadow-2xl overflow-y-auto transition-all duration-300 ease-out
          bottom-0 left-0 right-0 max-h-[85vh] rounded-t-2xl
          sm:inset-y-0 sm:left-auto sm:right-0 sm:w-96 sm:max-h-none sm:rounded-none
          ${
            isVisible
              ? "translate-y-0 sm:translate-y-0 sm:translate-x-0"
              : "translate-y-full sm:translate-y-0 sm:translate-x-full"
          }
        `}
        style={{
          transform: isDragging ? `translateY(${dragOffset}px)` : undefined,
          transition: isDragging ? "none" : undefined,
        }}
      >
        <Header handlers={handlers} onClose={onClose} />

        <div
          className={`px-4 sm:px-6 py-4 pb-6 sm:pb-4 space-y-6 transition-opacity duration-500 delay-100 ${
            isVisible ? "opacity-100" : "opacity-0"
          }`}
        >
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-1">Подаден</h3>
            <p className="text-base text-gray-900">
              {formatDate(message.createdAt)}
            </p>
          </div>

          {message.source && (
            <SourceDisplay
              sourceId={message.source}
              sourceUrl={message.sourceUrl}
            />
          )}

          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-1">Текст</h3>
            <p className="text-base text-gray-900 whitespace-pre-wrap">
              {message.text}
            </p>
          </div>

          {message.extractedData?.responsible_entity && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">
                Отговорна институция
              </h3>
              <p className="text-base text-gray-900">
                {message.extractedData.responsible_entity}
              </p>
            </div>
          )}

          <Locations
            pins={message.extractedData?.pins}
            streets={message.extractedData?.streets}
          />

          <Addresses
            addresses={message.addresses}
            onAddressClick={onAddressClick}
            onClose={onClose}
          />

          {message.geoJson?.features && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">
                Обекти на картата
              </h3>
              <p className="text-sm text-gray-900">
                {message.geoJson.features.length}{" "}
                {message.geoJson.features.length === 1 ? "обект" : "обекта"} на
                картата
              </p>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
