"use client";

import { useState } from "react";
import AuthButton from "./AuthButton";

export default function Header() {
  const [logoError, setLogoError] = useState(false);

  return (
    <>
      {/* Top Header - Dark Blue - max 60px visible height */}
      <header className="bg-[#2c3e50] text-white relative h-[60px]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full">
          {/* Main Header with Logo */}
          <div className="flex items-center justify-between h-full relative">
            {/* Left side - Logo and Title */}
            <div className="flex items-center">
              {/* Logo - overlaps into content area */}
              <div className="relative z-10">
                <div className="w-28 h-36 -mb-20">
                  {!logoError ? (
                    <img
                      src="/logo.png"
                      alt="СО Оборище"
                      className="w-full h-full object-contain"
                      onError={() => setLogoError(true)}
                    />
                  ) : (
                    <div className="w-28 h-36 bg-white rounded-lg flex items-center justify-center shadow-lg border-4 border-yellow-400">
                      <span className="text-[#2c3e50] font-bold text-sm text-center leading-tight">
                        <span className="block">СО</span>
                        <span className="block">Оборище</span>
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <div className="ml-6">
                <h1 className="text-lg font-bold">Район Оборище</h1>
              </div>
            </div>

            {/* Right side - Auth Button */}
            <div className="relative z-10">
              <AuthButton />
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Bar - Light Blue */}
      <nav className="bg-[#5DADE2]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-6 py-3">
            <a
              href="/"
              className="text-white hover:text-gray-200 text-sm font-medium"
            >
              НАЧАЛО
            </a>
          </div>
        </div>
      </nav>
    </>
  );
}
