"use client";
import { useEffect } from "react";

/**
 * Registers the storefront service worker (public/sw.js). Production-only —
 * a service worker in dev would cache Turbopack's HMR chunks and fight hot
 * reload.
 */
const PwaRegister = () => {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.error("Service worker registration failed:", err);
    });
  }, []);

  return null;
};

export default PwaRegister;
