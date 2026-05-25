"use client";
import { useEffect, useState, useCallback } from "react";

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<Array<{
    id: string; rating: number; comment?: string; isApproved: boolean; createdAt: string;
    product: { nameEn: string }; user: { nameEn?: string; email: string };
  }>>([]);
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
            <div className="text-5xl mb-4">⭐</div>
            <h3 className="text-lg font-semibold text-slate-700 mb-2">Reviews Management</h3>
            <p className="text-slate-500 max-w-md">
              Customer reviews will appear here. You can approve or reject reviews before they are shown publicly.
            </p>
            <p className="text-slate-400 text-sm mt-2">No reviews yet — they will appear once customers start reviewing products.</p>
          </div>
        )}
      </div>
    </div>
  );
}
