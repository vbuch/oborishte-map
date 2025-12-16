"use client";

import { useState } from "react";
import { LoadScript } from "@react-google-maps/api";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import MessageModal from "@/components/MessageModal";
import { AuthProvider } from "@/lib/auth-context";

export default function ClientLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);

  const handleOpenMessageModal = () => {
    setIsMessageModalOpen(true);
  };

  const handleCloseMessageModal = () => {
    setIsMessageModalOpen(false);
  };

  const handleMessageSubmit = () => {
    // Dispatch a custom event that the page can listen to
    globalThis.dispatchEvent(new CustomEvent("messageSubmitted"));
  };

  const handleAddInterest = () => {
    // Call the global function set by HomeContent
    if ((globalThis as any).__startAddInterest) {
      (globalThis as any).__startAddInterest();
    }
  };

  return (
    <div className="antialiased flex flex-col h-screen overflow-hidden">
      <LoadScript
        googleMapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ""}
      >
        <AuthProvider>
          <Header
            onOpenMessageModal={handleOpenMessageModal}
            onAddInterest={handleAddInterest}
          />
          <div className="flex-1 flex flex-col overflow-y-auto">
            <main className="flex-1 flex flex-col">{children}</main>
            <Footer />
          </div>
          <MessageModal
            isOpen={isMessageModalOpen}
            onClose={handleCloseMessageModal}
            onMessageSubmit={handleMessageSubmit}
          />
        </AuthProvider>
      </LoadScript>
    </div>
  );
}
