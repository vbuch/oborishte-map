"use client";

import { useState, useCallback } from "react";
import { ensureNotificationPermission } from "@/lib/notification-service";

interface NotificationPromptState {
  show: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

export function useNotificationPrompt() {
  const [promptState, setPromptState] =
    useState<NotificationPromptState | null>(null);

  const checkAndPromptForNotifications = useCallback(
    async (userId: string, idToken: string, hasCircles: boolean) => {
      if (!hasCircles) {
        return;
      }

      // Check if we should show the prompt (permission is "default")
      const currentPermission = Notification.permission;
      if (currentPermission !== "default") {
        // Already granted or denied, let ensureNotificationPermission handle it
        await ensureNotificationPermission(userId, idToken, hasCircles);
        return;
      }

      // Show our custom prompt before browser prompt
      setPromptState({
        show: true,
        onAccept: () => {
          setPromptState(null);
          ensureNotificationPermission(userId, idToken, hasCircles).catch(
            (err) => {
              console.error("Failed to ensure notification permission:", err);
            }
          );
        },
        onDecline: () => {
          setPromptState(null);
        },
      });
    },
    []
  );

  const hidePrompt = useCallback(() => {
    setPromptState(null);
  }, []);

  return {
    showPrompt: promptState?.show || false,
    onAccept: promptState?.onAccept || (() => {}),
    onDecline: promptState?.onDecline || (() => {}),
    checkAndPromptForNotifications,
    hidePrompt,
  };
}
