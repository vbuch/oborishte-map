"use client";

import { useState } from "react";
import PromptCard from "./PromptCard";
import { useAuth } from "@/lib/auth-context";

export default function LoginPrompt() {
  const [isVisible, setIsVisible] = useState(true);
  const { signInWithGoogle } = useAuth();

  if (!isVisible) {
    return null;
  }

  const handleLogin = () => {
    signInWithGoogle();
  };

  const handleClose = () => {
    setIsVisible(false);
  };

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 p-4 w-full max-w-md">
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
        title="Stay informed about local announcements"
        description="Log in to subscribe and get notifications whenever there are announcements where you are interested"
        primaryButton={{
          text: "Log in with Google",
          onClick: handleLogin,
        }}
        secondaryButton={{
          text: "Maybe later",
          onClick: handleClose,
        }}
      />
    </div>
  );
}
