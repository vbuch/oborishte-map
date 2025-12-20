"use client";

import { useState } from "react";

interface AddInterestsPromptProps {
  readonly onAddInterests: () => void;
}

export default function AddInterestsPrompt({
  onAddInterests,
}: AddInterestsPromptProps) {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) {
    return null;
  }

  const handleAddInterests = () => {
    setIsVisible(false);
    onAddInterests();
  };

  return (
    <div className="absolute bottom-4 right-4 z-40 bg-white rounded-lg shadow-xl p-6 pb-4 pr-4 max-w-sm">
      <div className="flex items-start gap-3 mb-4">
        <div className="flex-shrink-0">
          <svg
            className="w-10 h-10 text-blue-600"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
            <path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
          </svg>
        </div>
        <div className="flex-1">
          <h3 className="text-base font-semibold text-gray-900 mb-2">
            Получавай известия за местни съобщения
          </h3>
          <p className="text-sm text-gray-600">
            Добави зони, които следиш, и се абонирай, за да получаваш известия,
            когато има съобщение в тях. Следи това, което ти е важно.
          </p>
        </div>
      </div>
      <div className="flex justify-end">
        <button
          onClick={handleAddInterests}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-4 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2 font-medium text-sm"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path d="M12 4v16m8-8H4"></path>
          </svg>
          Добави зона
        </button>
      </div>
    </div>
  );
}
