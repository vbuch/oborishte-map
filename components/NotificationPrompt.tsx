"use client";

import PromptCard from "./PromptCard";

interface NotificationPromptProps {
  readonly onAccept: () => void;
  readonly onDecline: () => void;
}

export default function NotificationPrompt({
  onAccept,
  onDecline,
}: NotificationPromptProps) {
  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <PromptCard
        icon={
          <svg
            className="w-12 h-12 text-blue-600"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        }
        title="Получавай известия за събития в района"
        description="Искаш ли да получаваш известия, когато има нови съобщения за зоните, които следиш?"
        note="Можеш да промениш това по всяко време в настройките на браузъра."
        primaryButton={{
          text: "Разреши известия",
          onClick: onAccept,
        }}
        secondaryButton={{
          text: "Не сега",
          onClick: onDecline,
        }}
      />
    </div>
  );
}
