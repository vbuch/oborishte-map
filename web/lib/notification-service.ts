"use client";

import {
  getMessaging,
  getToken,
  onMessage,
  Messaging,
} from "firebase/messaging";
import { app } from "./firebase";
import { NotificationSubscription } from "./types";

let messaging: Messaging | null = null;

// Initialize messaging (only in browser)
if (globalThis.window !== undefined) {
  try {
    messaging = getMessaging(app);
  } catch (error) {
    console.error("Failed to initialize Firebase Messaging:", error);
  }
}

/**
 * Request notification permission from the user
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in globalThis)) {
    console.warn("This browser does not support notifications");
    return false;
  }

  // Check if permission is already granted
  if (Notification.permission === "granted") {
    return true;
  }

  // Request permission
  const permission = await Notification.requestPermission();
  return permission === "granted";
}

/**
 * Get the current notification permission status
 */
export function getNotificationPermission(): NotificationPermission {
  if (!("Notification" in globalThis)) {
    return "denied";
  }
  return Notification.permission;
}

/** * Track that user explicitly unsubscribed (to prevent auto-resubscription)
 */
function markExplicitUnsubscribe(userId: string): void {
  if (typeof globalThis.localStorage !== "undefined") {
    globalThis.localStorage.setItem(
      `notif_unsubscribed_${userId}`,
      Date.now().toString()
    );
  }
}

/**
 * Check if user explicitly unsubscribed recently (within 30 days)
 */
function hasExplicitlyUnsubscribed(userId: string): boolean {
  if (typeof globalThis.localStorage === "undefined") {
    return false;
  }

  const unsubscribedAt = globalThis.localStorage.getItem(
    `notif_unsubscribed_${userId}`
  );
  if (!unsubscribedAt) {
    return false;
  }

  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  const elapsed = Date.now() - Number.parseInt(unsubscribedAt, 10);
  return elapsed < thirtyDaysMs;
}

/**
 * Clear explicit unsubscribe flag (when user manually subscribes again)
 */
function clearExplicitUnsubscribe(userId: string): void {
  if (typeof globalThis.localStorage !== "undefined") {
    globalThis.localStorage.removeItem(`notif_unsubscribed_${userId}`);
  }
}

/**
 * Export markExplicitUnsubscribe for use in settings page
 */
export { markExplicitUnsubscribe };

/**
 * Check if user has a valid subscription
 */
export async function hasValidSubscription(
  userId: string,
  idToken: string
): Promise<boolean> {
  try {
    const response = await fetch("/api/notifications/subscription", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
    });

    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    return data.hasSubscription === true;
  } catch (error) {
    console.error("Error checking subscription:", error);
    // If offline, assume we don't have a valid subscription
    if (!navigator.onLine) {
      console.warn("Cannot check subscription while offline");
    }
    return false;
  }
}

/**
 * Subscribe to push notifications and save the subscription
 */
export async function subscribeToPushNotifications(
  userId: string,
  idToken: string
): Promise<NotificationSubscription | null> {
  if (!messaging) {
    console.error("Firebase Messaging not initialized");
    return null;
  }

  try {
    // Get FCM token
    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
    if (!vapidKey) {
      console.error("VAPID key not configured");
      return null;
    }

    const token = await getToken(messaging, { vapidKey });
    if (!token) {
      console.warn("No registration token available");
      return null;
    }

    // Clear explicit unsubscribe flag since user is subscribing
    clearExplicitUnsubscribe(userId);

    // Save subscription to backend
    const response = await fetch("/api/notifications/subscription", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        token,
        endpoint: `https://fcm.googleapis.com/fcm/send/${token}`,
        deviceInfo: {
          userAgent: navigator.userAgent,
        },
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to save subscription");
    }

    const subscription = await response.json();
    return subscription;
  } catch (error) {
    console.error("Error subscribing to push notifications:", error);
    // Check if offline
    if (!navigator.onLine) {
      console.error("Cannot subscribe to notifications while offline");
    }
    return null;
  }
}

/**
 * Check and request notification permission when user has circles
 */
export async function ensureNotificationPermission(
  userId: string,
  idToken: string,
  hasCircles: boolean,
  showPrompt?: (onAccept: () => void, onDecline: () => void) => void
): Promise<void> {
  // Only proceed if user has circles
  if (!hasCircles) {
    return;
  }

  // Check current permission status
  const currentPermission = getNotificationPermission();

  // If permission denied, don't ask again
  if (currentPermission === "denied") {
    return;
  }

  // If permission already granted, ensure subscription is valid
  if (currentPermission === "granted") {
    // Don't auto-resubscribe if user explicitly unsubscribed
    if (hasExplicitlyUnsubscribed(userId)) {
      return;
    }

    const hasSubscription = await hasValidSubscription(userId, idToken);
    if (!hasSubscription) {
      await subscribeToPushNotifications(userId, idToken);
    }
    return;
  }

  // Permission is "default" - show custom prompt first
  if (showPrompt) {
    // Custom prompt will be shown, callback will handle the request
    showPrompt(
      async () => {
        const granted = await requestNotificationPermission();
        if (granted) {
          await subscribeToPushNotifications(userId, idToken);
        }
      },
      () => {
        // User declined
      }
    );
  } else {
    // Fallback: request permission directly
    const granted = await requestNotificationPermission();

    if (granted) {
      await subscribeToPushNotifications(userId, idToken);
    }
  }
}
