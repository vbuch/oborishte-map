interface SubscriptionCountProps {
  readonly count: number;
}

export default function SubscriptionCount({ count }: SubscriptionCountProps) {
  return (
    <div className="mb-4">
      <p className="text-gray-600">
        Брой активни абонаменти: <span className="font-semibold">{count}</span>
      </p>
    </div>
  );
}
