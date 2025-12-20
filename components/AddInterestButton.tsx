"use client";

interface AddInterestButtonProps {
  readonly onClick: () => void;
}

export default function AddInterestButton({ onClick }: AddInterestButtonProps) {
  return (
    <button
      onClick={onClick}
      className="absolute bottom-8 right-8 z-30 bg-blue-600 hover:bg-blue-700 text-white px-6 py-4 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2 font-medium text-sm"
      aria-label="Добави зона"
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
  );
}
