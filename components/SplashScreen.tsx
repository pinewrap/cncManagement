"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

export default function SplashScreen() {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    // Start fade after 1.2s, fully remove after 1.7s
    const fadeTimer = setTimeout(() => setFading(true), 1200);
    const removeTimer = setTimeout(() => setVisible(false), 1700);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        backgroundColor: "#FFC20E",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "16px",
        transition: "opacity 0.5s ease",
        opacity: fading ? 0 : 1,
        pointerEvents: fading ? "none" : "auto",
      }}
    >
      <Image
        src="/icon-512.png"
        alt="CNC Lubricants"
        width={120}
        height={120}
        priority
        style={{ borderRadius: "16px" }}
      />
      <p
        style={{
          fontFamily: "Helvetica, Arial, sans-serif",
          fontWeight: "bold",
          fontSize: "18px",
          color: "#16243F",
          letterSpacing: "0.02em",
        }}
      >
        CNC Grease &amp; Lubricants
      </p>
    </div>
  );
}
