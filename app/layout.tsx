import type { Metadata, Viewport } from "next";
import Nav from "@/components/Nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Invoicing App",
  description: "Inventory and invoicing",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Invoicing App",
  },
};

export const viewport: Viewport = {
  themeColor: "#16243F",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900">
        <Nav />
        <div className="mx-auto max-w-4xl px-4 py-6">{children}</div>
      </body>
    </html>
  );
}
