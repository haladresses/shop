"use client";
import { useEffect, useState } from "react";

/** Fetches a report endpoint; refetches when the URL changes and ignores stale responses. */
export function useReportData<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    fetch(url, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d.success) setData(d.data as T);
        else setError(d.error || "Could not load the report");
      })
      .catch(() => !cancelled && setError("Could not load the report"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [url]);

  return { data, loading, error };
}
