"use client";

import { useState } from "react";

interface DeleteAccountSectionProps {
  readonly onDeleteAccount: (confirmText: string) => Promise<void>;
  readonly isDeleting: boolean;
}

export default function DeleteAccountSection({
  onDeleteAccount,
  isDeleting,
}: DeleteAccountSectionProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const handleConfirm = async () => {
    await onDeleteAccount(confirmText);
    // Reset state after attempt
    setShowConfirm(false);
    setConfirmText("");
  };

  return (
    <section className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">
        Изтриване на профил
      </h2>

      <p className="text-gray-600 mb-4">
        Това действие ще изтрие всички ваши данни, включително зони на интерес,
        абонаменти за известия и история на известия.
      </p>

      {showConfirm ? (
        <div className="border border-red-300 rounded-lg p-4 bg-red-50 relative z-30">
          <p className="text-red-900 font-semibold mb-3">
            Сигурни ли сте, че искате да изтриете профила си?
          </p>
          <p className="text-red-800 text-sm mb-4">
            Това действие е необратимо. Напишете <strong>ИЗТРИЙ</strong> за
            потвърждение:
          </p>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="ИЗТРИЙ"
            className="w-full px-3 py-2 border border-red-300 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-red-500"
          />
          <div className="flex gap-3">
            <button
              onClick={handleConfirm}
              disabled={isDeleting || confirmText !== "ИЗТРИЙ"}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDeleting ? "Изтриване..." : "Потвърди изтриването"}
            </button>
            <button
              onClick={() => {
                setShowConfirm(false);
                setConfirmText("");
              }}
              disabled={isDeleting}
              className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50"
            >
              Отказ
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowConfirm(true)}
          className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
        >
          Изтрий профила ми
        </button>
      )}
    </section>
  );
}
