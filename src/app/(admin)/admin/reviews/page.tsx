"use client";
import { useEffect, useState, useCallback } from "react";
import { LuStar } from "react-icons/lu";

export default function ReviewsPage() {
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    // Reviews come via product API — for now fetch a simplified endpoint
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className="admin-card">
        {loading ? (
          <div className="flex justify-center py-12"><div className="spinner" /></div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <LuStar className="text-slate-300 mb-3" size={32} />
            <p className="text-slate-600 max-w-md">
              Customer reviews will appear here. You can approve or reject reviews before they are shown publicly.
            </p>
            <p className="text-slate-400 text-sm mt-2">No reviews yet: they will appear once customers start reviewing products.</p>
          </div>
        )}
      </div>
    </div>
  );
}
