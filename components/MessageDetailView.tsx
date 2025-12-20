"use client";

import React, { useEffect, useState } from "react";
import { Message } from "@/lib/types";
import { useDragToClose } from "@/lib/hooks/useDragToClose";

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
      // Small delay to trigger animation
      requestAnimationFrame(() => {
        setIsVisible(true);
      });
    } else {
      setIsVisible(false);
      // Wait for animation to complete before unmounting
      const timer = setTimeout(() => {
        setShouldRender(false);
      }, 300); // Match animation duration
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
      {/* Backdrop with fade-in animation */}
      <div
        className={`fixed inset-0 z-30 bg-black/20 backdrop-blur-sm transition-opacity duration-300 ${
          isVisible ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-in panel - bottom sheet on mobile, sidebar on desktop */}
      <aside
        aria-label="Детайли за сигнала"
        className={`fixed z-40 bg-white shadow-2xl overflow-y-auto transition-all duration-300 ease-out
          ${/* Mobile: bottom sheet */ ""}
          bottom-0 left-0 right-0 max-h-[85vh] rounded-t-2xl
          ${/* Desktop: right sidebar */ ""}
          sm:inset-y-0 sm:left-auto sm:right-0 sm:w-96 sm:max-h-none sm:rounded-none
          ${/* Animation states */ ""}
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
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-4 sm:px-6 py-4 flex items-center justify-between shadow-sm z-10">
          {/* Mobile drag handle */}
          <button
            type="button"
            className="absolute top-2 left-1/2 -translate-x-1/2 w-12 h-1 bg-gray-300 rounded-full sm:hidden cursor-grab active:cursor-grabbing"
            {...handlers}
            onClick={onClose}
            aria-label="Плъзни, за да затвориш, или натисни, за да затвориш"
          />

          <h2 className="text-lg sm:text-xl font-semibold text-gray-900 pt-3 sm:pt-0">
            Детайли за сигнала
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 hover:bg-gray-100 rounded-full mt-3 sm:mt-0"
            aria-label="Затвори детайлите"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>

        {/* Content */}
        <div
          className={`px-4 sm:px-6 py-4 pb-6 sm:pb-4 space-y-6 transition-opacity duration-500 delay-100 ${
            isVisible ? "opacity-100" : "opacity-0"
          }`}
        >
          {/* Date */}
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-1">Подаден</h3>
            <p className="text-base text-gray-900">
              {formatDate(message.createdAt)}
            </p>
          </div>

          {/* Message Text */}
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-1">Текст</h3>
            <p className="text-base text-gray-900 whitespace-pre-wrap">
              {message.text}
            </p>
          </div>

          {/* Responsible Entity */}
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

          {/* Pins/Locations */}
          {message.extractedData?.pins &&
            message.extractedData.pins.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">
                  Локации
                </h3>
                <div className="space-y-3">
                  {message.extractedData.pins.map((pin, index) => (
                    <div
                      key={`pin-${pin.address}-${index}`}
                      className="bg-gray-50 rounded-md p-3 border border-gray-200"
                    >
                      <p className="text-sm font-medium text-gray-900 mb-1">
                        {pin.address}
                      </p>
                      {pin.timespans && pin.timespans.length > 0 && (
                        <div className="text-xs text-gray-600 space-y-1">
                          {pin.timespans.map((timespan, tIndex) => (
                            <div
                              key={`timespan-${timespan.start}-${timespan.end}-${tIndex}`}
                            >
                              {timespan.start} - {timespan.end}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

          {/* Street Sections */}
          {message.extractedData?.streets &&
            message.extractedData.streets.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">
                  Улични участъци
                </h3>
                <div className="space-y-3">
                  {message.extractedData.streets.map((street, index) => (
                    <div
                      key={`street-${street.street}-${street.from}-${street.to}-${index}`}
                      className="bg-gray-50 rounded-md p-3 border border-gray-200"
                    >
                      <p className="text-sm font-medium text-gray-900 mb-1">
                        {street.street}
                      </p>
                      <p className="text-xs text-gray-600 mb-1">
                        От: {street.from} → До: {street.to}
                      </p>
                      {street.timespans && street.timespans.length > 0 && (
                        <div className="text-xs text-gray-600 space-y-1">
                          {street.timespans.map((timespan, tIndex) => (
                            <div
                              key={`street-timespan-${timespan.start}-${timespan.end}-${tIndex}`}
                            >
                              {timespan.start} - {timespan.end}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

          {/* Addresses (if no extracted data) */}
          {message.addresses && message.addresses.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Адреси</h3>
              <div className="space-y-2">
                {message.addresses.map((address, index) => (
                  <button
                    key={`address-${address.formattedAddress}-${index}`}
                    onClick={() => {
                      onAddressClick?.(
                        address.coordinates.lat,
                        address.coordinates.lng
                      );
                      onClose();
                    }}
                    className="w-full text-left bg-gray-50 rounded-md p-3 border border-gray-200 hover:bg-blue-50 hover:border-blue-300 transition-colors cursor-pointer"
                  >
                    <p className="text-sm text-gray-900">
                      {address.formattedAddress}
                    </p>
                    {address.coordinates && (
                      <p className="text-xs text-gray-500 mt-1">
                        {address.coordinates.lat.toFixed(6)},{" "}
                        {address.coordinates.lng.toFixed(6)}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* GeoJSON Feature Count */}
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
