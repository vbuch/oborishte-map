interface ErrorBannerProps {
  readonly message: string;
}

export default function ErrorBanner({ message }: ErrorBannerProps) {
  return (
    <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
      {message}
    </div>
  );
}
