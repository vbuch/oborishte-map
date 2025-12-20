"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";

interface HeaderProps {
  readonly onOpenMessageModal: () => void;
  readonly onAddInterest?: () => void;
}

export default function Header({
  onOpenMessageModal,
  onAddInterest,
}: HeaderProps) {
  const { user, signOut } = useAuth();
  const [logoError, setLogoError] = useState(false);

  return (
    <>
      {/* Top Header - Dark Blue */}
      <header className="bg-[#2c3e50] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Main Header with Logo */}
          <div className="flex items-center justify-between py-3">
            {/* Left side - Logo and Title */}
            <div className="flex items-center gap-4">
              {/* Logo - contained within header */}
              <div className="flex-shrink-0">
                {logoError ? (
                  <div className="h-12 w-12 bg-white rounded flex items-center justify-center border-2 border-yellow-400">
                    <span className="text-[#2c3e50] font-bold text-xs text-center leading-tight">
                      СО
                    </span>
                  </div>
                ) : (
                  <img
                    src="/logo.png"
                    alt="СО Оборище"
                    className="h-12 w-auto object-contain"
                    onError={() => setLogoError(true)}
                  />
                )}
              </div>
              <div>
                <h1 className="text-lg font-bold">Район Оборище</h1>
              </div>
            </div>

            {/* Right side - User Info */}
            <div>
              {user && (
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    {user.photoURL && (
                      <img
                        src={user.photoURL}
                        alt={user.displayName || "User"}
                        className="w-8 h-8 rounded-full"
                      />
                    )}
                    <span className="text-sm text-white hidden sm:inline">
                      {user.displayName || user.email}
                    </span>
                  </div>
                  <button
                    onClick={signOut}
                    className="px-4 py-2 text-sm font-medium text-white bg-[#E74C3C] rounded-md hover:bg-[#C0392B] transition-colors"
                  >
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Bar - Light Blue */}
      <nav className="bg-[#5DADE2]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-6 py-3 items-center">
            <a
              href="/"
              className="text-white hover:text-gray-200 text-sm font-medium"
            >
              НАЧАЛО
            </a>
            {user && (
              <>
                <button
                  onClick={onOpenMessageModal}
                  className="text-white hover:text-gray-200 text-sm font-medium flex items-center gap-1"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path d="M12 4v16m8-8H4"></path>
                  </svg>
                  СЪОБЩЕНИЕ
                </button>
                {onAddInterest && (
                  <button
                    onClick={onAddInterest}
                    className="text-white hover:text-gray-200 text-sm font-medium flex items-center gap-1"
                  >
                    <svg
                      className="w-4 h-4"
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
                    МОИ ИНТЕРЕСИ
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </nav>
    </>
  );
}
