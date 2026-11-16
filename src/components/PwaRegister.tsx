"use client";
import { useEffect } from "react";

/**
 * Registers the storefront service worker (public/sw.js) in production.
 *
 * In development it does the opposite: a worker left over from running a
 * production build on localhost keeps serving its cached copies of old
 * JavaScript, which makes the page "fight" the dev server (hydration
 * mismatches, stale text). So in dev we unregister any worker and delete
 * the caches it created.
 */
const PwaRegister = () => {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => Promise.all(regs.map((r) => r.unregister())))
        .catch(() => {});
      if ("caches" in window) {
        caches
          .keys()
          .then((keys) => Promise.all(keys.filter((k) => k.startsWith("hala-")).map((k) => caches.delete(k))))
          .catch(() => {});
      }
      return;
    }

    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.error("Service worker registration failed:", err);
    });
  }, []);

  return null;
};

export default PwaRegister;
