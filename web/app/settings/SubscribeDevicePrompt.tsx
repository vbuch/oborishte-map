interface SubscribeDevicePromptProps {
  readonly onSubscribe: () => void;
  readonly hasAnySubscriptions: boolean;
}

export default function SubscribeDevicePrompt({
  onSubscribe,
  hasAnySubscriptions,
}: SubscribeDevicePromptProps) {
  return (
    <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
      <p className="text-yellow-800 mb-2">
        {hasAnySubscriptions
          ? "Текущото устройство не е абонирано за известия."
          : "Няма абонамент за известия на нито едно устройство. Това е основната задача на OboApp. Абонирай се!"}
      </p>
      <button
        onClick={onSubscribe}
        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
      >
        Абонирай това устройство
      </button>
    </div>
  );
}
