interface UnsubscribeAllButtonProps {
  readonly onUnsubscribeAll: () => void;
}

export default function UnsubscribeAllButton({
  onUnsubscribeAll,
}: UnsubscribeAllButtonProps) {
  return (
    <button
      onClick={onUnsubscribeAll}
      className="text-sm text-red-600 hover:text-red-700 hover:underline"
    >
      Отписване от всички устройства
    </button>
  );
}
