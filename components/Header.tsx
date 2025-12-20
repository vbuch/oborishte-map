"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";

interface HeaderProps {
  readonly onOpenMessageModal: () => void;
}

export default function Header({ onOpenMessageModal }: HeaderProps) {
  const { user, signOut } = useAuth();
  const [logoError, setLogoError] = useState(false);

  return (
    <>
      {/* Top Header - Dark Blue */}
      <header className="bg-[#2c3e50] text-white relative z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Main Header with Logo */}
          <div className="flex items-center justify-between py-3">
            {/* Left side - Logo and Title */}
            <div className="flex items-center gap-4">
              {/* Logo - overlapping content below */}
              <div className="flex-shrink-0 relative -mb-20">
                {logoError ? (
                  <div className="h-32 w-32 bg-white rounded flex items-center justify-center border-2 border-yellow-400 relative z-30">
                    <span className="text-[#2c3e50] font-bold text-2xl text-center leading-tight">
                      СО
                    </span>
                  </div>
                ) : (
                  <img
                    src="/logo.png"
                    alt="СО Оборище"
                    className="h-32 w-auto object-contain relative z-30"
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
                  {user.email === "valery.buchinsky@gmail.com" && (
                    <button
                      onClick={onOpenMessageModal}
                      className="p-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-all duration-200"
                      aria-label="Send message"
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
                        <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
                      </svg>
                    </button>
                  )}
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
            {/* Navigation items can be added here */}
          </div>
        </div>
      </nav>
    </>
  );
}
