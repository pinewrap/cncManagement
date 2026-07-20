import type { Metadata, Viewport } from "next";
import Nav from "@/components/Nav";
import SplashScreen from "@/components/SplashScreen";
import "./globals.css";

export const metadata: Metadata = {
  title: "CNC Lubricants",
  description: "Inventory and invoicing for CNC Grease & Lubricants",
  icons: {
    icon: "/icon-192.png",
    apple: "/icon-192.png",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "CNC Lubricants",
  },
};

export const viewport: Viewport = {
  themeColor: "#FFC20E",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900">
        <SplashScreen />
        <Nav />
        <div className="mx-auto max-w-4xl px-4 py-6">{children}</div>
      </body>
    </html>
  );
}
