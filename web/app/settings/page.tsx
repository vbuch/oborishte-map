"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Interest, NotificationSubscription } from "@/lib/types";
import {
  subscribeToPushNotifications,
  requestNotificationPermission,
  markExplicitUnsubscribe,
  getNotificationPermission,
} from "@/lib/notification-service";
import { getMessaging, getToken } from "firebase/messaging";
import { app } from "@/lib/firebase";
import NotificationsSection from "./NotificationsSection";
import ZonesSection from "./ZonesSection";
import DeleteAccountSection from "./DeleteAccountSection";
import DeleteSuccessMessage from "./DeleteSuccessMessage";
import LoadingState from "./LoadingState";
import SettingsHeader from "./SettingsHeader";
import ErrorBanner from "./ErrorBanner";

export default function SettingsPage() {
  const { user, signOut, reauthenticateWithGoogle } = useAuth();
  const router = useRouter();

  const [interests, setInterests] = useState<Interest[]>([]);
  const [subscriptions, setSubscriptions] = useState<
    NotificationSubscription[]
  >([]);
  const [currentDeviceToken, setCurrentDeviceToken] = useState<string | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Delete account state
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteSuccess, setDeleteSuccess] = useState(false);

  // Fetch data
  useEffect(() => {
    if (!user) {
      router.push("/");
      return;
    }

    fetchData();
  }, [user, router]);

  // Get current device FCM token
  useEffect(() => {
    const getCurrentToken = async () => {
      try {
        const messaging = getMessaging(app);
        const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
        if (!vapidKey) return;

        const token = await getToken(messaging, { vapidKey });
        if (token) {
          setCurrentDeviceToken(token);
        }
      } catch (error) {
        console.error("Error getting current device token:", error);
      }
    };

    if (globalThis.window !== undefined) {
      getCurrentToken();
    }
  }, []);

  const fetchData = async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      setError(null);

      const token = await user.getIdToken();
      const authHeader = `Bearer ${token}`;

      // Fetch interests and subscriptions in parallel
      const [interestsRes, subscriptionsRes] = await Promise.all([
        fetch("/api/interests", {
          headers: { Authorization: authHeader },
        }),
        fetch("/api/notifications/subscription/all", {
          headers: { Authorization: authHeader },
        }),
      ]);

      if (!interestsRes.ok || !subscriptionsRes.ok) {
        throw new Error("Failed to fetch data");
      }

      const [interestsData, subscriptionsData] = await Promise.all([
        interestsRes.json(),
        subscriptionsRes.json(),
      ]);

      setInterests(
        Array.isArray(interestsData?.interests) ? interestsData.interests : []
      );
      setSubscriptions(
        Array.isArray(subscriptionsData) ? subscriptionsData : []
      );
    } catch (err) {
      console.error("Error fetching data:", err);
      setError("Неуспешно зареждане на данни");
      // Ensure arrays are set even on error
      setInterests([]);
      setSubscriptions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubscribeCurrentDevice = async () => {
    if (!user) return;

    try {
      // Check if notifications are blocked
      const currentPermission = getNotificationPermission();
      if (currentPermission === "denied") {
        alert(
          "Известията са блокирани в браузъра. За да ги разрешите:\n\n" +
            "1. Кликнете на иконката на катинара/информацията до адресната лента\n" +
            "2. Намерете настройките за известия\n" +
            "3. Разрешете известията за този сайт\n" +
            "4. Презаредете страницата"
        );
        return;
      }

      const granted = await requestNotificationPermission();
      if (!granted) {
        alert("Моля, разрешете известия в браузъра");
        return;
      }

      const token = await user.getIdToken();
      await subscribeToPushNotifications(user.uid, token);
      await fetchData(); // Refresh subscriptions
    } catch (error) {
      console.error("Error subscribing:", error);
      alert("Грешка при абонирането");
    }
  };

  const handleUnsubscribeDevice = async (deviceToken: string) => {
    if (!user) return;

    try {
      const token = await user.getIdToken();
      const response = await fetch(
        `/api/notifications/subscription?token=${encodeURIComponent(
          deviceToken
        )}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to unsubscribe");
      }

      // Mark that user explicitly unsubscribed
      markExplicitUnsubscribe(user.uid);

      await fetchData(); // Refresh subscriptions
    } catch (error) {
      console.error("Error unsubscribing:", error);
      alert("Грешка при отписването");
    }
  };

  const handleUnsubscribeAll = async () => {
    if (!user) return;
    if (
      !confirm("Сигурни ли сте, че искате да се отпишете от всички устройства?")
    ) {
      return;
    }

    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/notifications/subscription/all", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error("Failed to unsubscribe all");
      }

      // Mark that user explicitly unsubscribed
      markExplicitUnsubscribe(user.uid);

      await fetchData(); // Refresh subscriptions
    } catch (error) {
      console.error("Error unsubscribing all:", error);
      alert("Грешка при отписването от всички устройства");
    }
  };

  const handleDeleteAccount = async (confirmText: string) => {
    if (confirmText !== "ИЗТРИЙ") {
      alert("Моля, напишете 'ИЗТРИЙ' за потвърждение");
      return;
    }

    setIsDeleting(true);

    try {
      // Step 1: Re-authenticate user for security
      try {
        await reauthenticateWithGoogle();
      } catch (reauthError) {
        console.error("Re-authentication failed:", reauthError);
        alert("Необходима е повторна идентификация. Моля, опитайте отново.");
        setIsDeleting(false);
        return;
      }

      // Step 2: Delete all user data from backend
      const token = await user!.getIdToken();
      const response = await fetch("/api/user", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error("Failed to delete account");
      }

      setDeleteSuccess(true);

      // Sign out after 2 seconds
      setTimeout(async () => {
        await signOut();
        router.push("/");
      }, 2000);
    } catch (error) {
      console.error("Error deleting account:", error);
      alert("Грешка при изтриването на профила");
      setIsDeleting(false);
    }
  };

  if (!user) {
    return null;
  }

  if (deleteSuccess) {
    return <DeleteSuccessMessage />;
  }

  if (isLoading) {
    return <LoadingState />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <SettingsHeader />

        {error && <ErrorBanner message={error} />}

        <NotificationsSection
          subscriptions={subscriptions}
          currentDeviceToken={currentDeviceToken}
          onSubscribeCurrentDevice={handleSubscribeCurrentDevice}
          onUnsubscribeDevice={handleUnsubscribeDevice}
          onUnsubscribeAll={handleUnsubscribeAll}
        />

        <ZonesSection interests={interests} />

        <DeleteAccountSection
          onDeleteAccount={handleDeleteAccount}
          isDeleting={isDeleting}
        />
      </div>
    </div>
  );
}
