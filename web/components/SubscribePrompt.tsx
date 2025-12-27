import Link from "next/link";

interface SubscribePromptProps {
  readonly onClose: () => void;
}

export default function SubscribePrompt({ onClose }: SubscribePromptProps) {
  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 p-4 w-full max-w-md">
      <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg shadow-xl p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 text-2xl">⚠️</div>
          <div className="flex-1">
            <h3 className="font-semibold text-yellow-900 mb-2">
              Няма абонамент за известия
            </h3>
            <p className="text-yellow-800 text-sm mb-3">
              Имате зони на интерес, но не сте абонирани за известия. Това е
              основната задача на OboApp!
            </p>
            <div className="flex gap-2">
              <Link
                href="/settings"
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                Отиди в настройки
              </Link>
              <button
                onClick={onClose}
                className="bg-yellow-200 text-yellow-900 px-4 py-2 rounded-lg hover:bg-yellow-300 transition-colors text-sm"
              >
                По-късно
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
