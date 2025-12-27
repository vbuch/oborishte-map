import { NotificationSubscription } from "@/lib/types";
import { parseUserAgent } from "@/lib/parse-user-agent";

interface DeviceSubscriptionCardProps {
  readonly subscription: NotificationSubscription;
  readonly isCurrentDevice: boolean;
  readonly onUnsubscribe: (token: string) => void;
}

export default function DeviceSubscriptionCard({
  subscription,
  isCurrentDevice,
  onUnsubscribe,
}: DeviceSubscriptionCardProps) {
  const parsed = parseUserAgent(subscription.deviceInfo?.userAgent || "");
  const createdDate = new Date(subscription.createdAt).toLocaleDateString(
    "bg-BG",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    }
  );

  return (
    <div
      className={`border rounded-lg p-3 flex items-center justify-between gap-4 ${
        isCurrentDevice ? "border-blue-500 bg-blue-50" : "border-gray-200"
      }`}
    >
      <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center sm:gap-2">
        <p className="font-medium text-gray-900 text-sm flex items-center gap-2">
          <span>{parsed.displayName}</span>
          {isCurrentDevice && (
            <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded whitespace-nowrap">
              Това устройство
            </span>
          )}
        </p>
        <p className="text-xs text-gray-500 sm:before:content-['•'] sm:before:mr-2">
          Добавено: {createdDate}
        </p>
      </div>
      <button
        onClick={() => onUnsubscribe(subscription.token)}
        className="text-xs text-red-600 hover:text-red-700 hover:underline whitespace-nowrap flex-shrink-0"
      >
        Отписване
      </button>
    </div>
  );
}
