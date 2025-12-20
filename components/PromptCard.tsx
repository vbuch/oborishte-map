"use client";

import React from "react";

interface PromptCardProps {
  readonly icon?: React.ReactNode;
  readonly title: string;
  readonly description: string;
  readonly note?: string;
  readonly primaryButton: {
    readonly text: string;
    readonly onClick: () => void;
  };
  readonly secondaryButton: {
    readonly text: string;
    readonly onClick: () => void;
  };
}

export default function PromptCard({
  icon,
  title,
  description,
  note,
  primaryButton,
  secondaryButton,
}: PromptCardProps) {
  return (
    <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
      <div className="flex items-start gap-4">
        {icon && <div className="flex-shrink-0">{icon}</div>}
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
          <p className="text-sm text-gray-600 mb-4">{description}</p>
          {note && <p className="text-xs text-gray-500 mb-4">{note}</p>}
          <div className="flex gap-3">
            <button
              onClick={primaryButton.onClick}
              className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
            >
              {primaryButton.text}
            </button>
            <button
              onClick={secondaryButton.onClick}
              className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-300 transition-colors"
            >
              {secondaryButton.text}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
