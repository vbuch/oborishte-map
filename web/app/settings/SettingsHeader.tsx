import Link from "next/link";

export default function SettingsHeader() {
  return (
    <div className="mb-8">
      <Link
        href="/"
        className="text-sm text-blue-600 hover:text-blue-700 mb-4 inline-block"
      >
        ← Начало
      </Link>
      <h1 className="text-3xl font-bold text-gray-900">Настройки</h1>
    </div>
  );
}
