"use client";

import { NotificationSubscription } from "@/lib/types";
import SubscriptionCount from "./SubscriptionCount";
import SubscribeDevicePrompt from "./SubscribeDevicePrompt";
import DeviceSubscriptionCard from "./DeviceSubscriptionCard";
import UnsubscribeAllButton from "./UnsubscribeAllButton";

interface NotificationsSectionProps {
  readonly subscriptions: NotificationSubscription[];
  readonly currentDeviceToken: string | null;
  readonly onSubscribeCurrentDevice: () => void;
  readonly onUnsubscribeDevice: (token: string) => void;
  readonly onUnsubscribeAll: () => void;
}

export default function NotificationsSection({
  subscriptions,
  currentDeviceToken,
  onSubscribeCurrentDevice,
  onUnsubscribeDevice,
  onUnsubscribeAll,
}: NotificationsSectionProps) {
  const isCurrentDeviceSubscribed = subscriptions.some(
    (sub) => sub.token === currentDeviceToken
  );

  return (
    <section className="bg-white rounded-lg shadow mb-6 p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Известия</h2>

      <SubscriptionCount count={subscriptions.length} />

      {!isCurrentDeviceSubscribed && (
        <SubscribeDevicePrompt
          onSubscribe={onSubscribeCurrentDevice}
          hasAnySubscriptions={subscriptions.length > 0}
        />
      )}

      {subscriptions.length > 0 && (
        <div className="space-y-2 mb-4">
          {subscriptions.map((sub) => (
            <DeviceSubscriptionCard
              key={sub.id}
              subscription={sub}
              isCurrentDevice={sub.token === currentDeviceToken}
              onUnsubscribe={onUnsubscribeDevice}
            />
          ))}
        </div>
      )}

      {subscriptions.length > 1 && (
        <UnsubscribeAllButton onUnsubscribeAll={onUnsubscribeAll} />
      )}
    </section>
  );
}
