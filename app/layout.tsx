import type { Metadata } from "next";
import "./globals.css";
import ClientLayout from "@/components/ClientLayout";

export const metadata: Metadata = {
  title: "Карта Оборище",
  description: "Следи събитията в район Оборище",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="bg">
      <body>
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
