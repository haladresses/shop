"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LuChevronLeft, LuImage, LuMessageSquare, LuTrash2, LuUpload, LuX } from "react-icons/lu";

type WhatsappReview = {
  id: string;
  imageUrl: string;
  customerName: string | null;
  caption: string | null;
  createdAt: string;
};

export default function ProductWhatsappReviewsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [productName, setProductName] = useState("");
  const [reviews, setReviews] = useState<WhatsappReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [customerName, setCustomerName] = useState("");
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/products/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setProductName(d.data.nameEn || d.data.nameAr || "");
      })
      .catch(() => {});
  }, [id]);

  const loadReviews = () => {
    setLoading(true);
    fetch(`/api/products/${id}/whatsapp-reviews`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setReviews(d.data);
      })
      .catch(() => setBanner({ type: "error", text: "Failed to load reviews" }))
      .finally(() => setLoading(false));
  };

  useEffect(loadReviews, [id]);

  const pickFile = (f: File | null) => {
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : "");
  };

  const resetForm = () => {
    pickFile(null);
    setCustomerName("");
    setCaption("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const upload = async () => {
    if (!file) {
      setBanner({ type: "error", text: "Please choose a screenshot first." });
      return;
    }
    setUploading(true);
    setBanner(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (customerName.trim()) fd.append("customerName", customerName.trim());
      if (caption.trim()) fd.append("caption", caption.trim());
      const res = await fetch(`/api/products/${id}/whatsapp-reviews`, { method: "POST", body: fd });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Upload failed");
      resetForm();
      setBanner({ type: "success", text: "Screenshot added." });
      loadReviews();
    } catch (e) {
      setBanner({ type: "error", text: e instanceof Error ? e.message : "Upload failed" });
    } finally {
      setUploading(false);
    }
  };

  const remove = async (reviewId: string) => {
    if (!window.confirm("Delete this WhatsApp review screenshot?")) return;
    setDeletingId(reviewId);
    try {
      const res = await fetch(`/api/products/${id}/whatsapp-reviews?reviewId=${encodeURIComponent(reviewId)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Delete failed");
      setReviews((prev) => prev.filter((r) => r.id !== reviewId));
    } catch (e) {
      setBanner({ type: "error", text: e instanceof Error ? e.message : "Delete failed" });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {banner && (
        <div
          className={`flex items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm font-medium shadow-sm ${
            banner.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
          }`}
        >
          <span>{banner.text}</span>
          <button type="button" onClick={() => setBanner(null)} aria-label="Dismiss" className="rounded-full p-1 hover:bg-black/5">
            <LuX size={14} />
          </button>
        </div>
      )}

      {/* Header */}
      <section className="admin-card border border-slate-200 p-5 sm:p-6">
        <Link
          href={`/admin/products/${id}`}
          className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
        >
          <LuChevronLeft size={16} /> Back to product
        </Link>
        <div className="flex items-start gap-3">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-green-50 text-green-600">
            <LuMessageSquare size={20} />
          </span>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">WhatsApp Reviews</h1>
            <p className="mt-1 text-sm text-slate-500">
              Upload screenshots of customer reviews received on WhatsApp for{" "}
              <span className="font-medium text-slate-700">{productName || "this product"}</span>. They appear in the WhatsApp
              Reviews tab on the storefront product page.
            </p>
          </div>
        </div>
      </section>

      {/* Uploader */}
      <section className="admin-card border border-slate-200 p-5 sm:p-6">
        <h2 className="text-base font-semibold text-slate-900">Add a screenshot</h2>
        <div className="mt-4 grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
          {/* Drop / preview area */}
          <label
            htmlFor="wa-file"
            className="flex aspect-[3/4] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 text-center transition-colors hover:border-slate-300"
          >
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Preview" className="h-full w-full object-contain" />
            ) : (
              <span className="flex flex-col items-center gap-2 px-4 text-slate-400">
                <LuImage size={28} />
                <span className="text-xs font-medium">Click to choose a screenshot</span>
                <span className="text-[11px]">JPG, PNG, WEBP · up to 5MB</span>
              </span>
            )}
            <input
              ref={fileInputRef}
              id="wa-file"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            />
          </label>

          {/* Fields */}
          <div className="flex flex-col gap-4">
            <div>
              <label htmlFor="wa-name" className="mb-1.5 block text-sm font-medium text-slate-700">
                Customer name <span className="text-slate-400">(optional)</span>
              </label>
              <input
                id="wa-name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="e.g. Aisha"
                className="admin-input rounded-xl border-slate-200 bg-white focus:border-slate-300"
              />
            </div>
            <div>
              <label htmlFor="wa-caption" className="mb-1.5 block text-sm font-medium text-slate-700">
                Caption <span className="text-slate-400">(optional)</span>
              </label>
              <textarea
                id="wa-caption"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={3}
                placeholder="Short note shown under the screenshot"
                className="admin-input rounded-xl border-slate-200 bg-white focus:border-slate-300"
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={upload}
                disabled={uploading || !file}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                <LuUpload size={16} /> {uploading ? "Uploading..." : "Add screenshot"}
              </button>
              {file ? (
                <button type="button" onClick={resetForm} className="text-sm font-medium text-slate-500 hover:text-slate-700">
                  Clear
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {/* Gallery */}
      <section className="admin-card border border-slate-200 p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">
            Screenshots <span className="text-slate-400">({reviews.length})</span>
          </h2>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="spinner" />
          </div>
        ) : reviews.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-12 text-center">
            <div className="mx-auto mb-2 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-slate-400">
              <LuImage size={20} />
            </div>
            <p className="text-sm font-medium text-slate-700">No screenshots yet</p>
            <p className="mt-1 text-xs text-slate-500">Upload the first WhatsApp review above.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {reviews.map((r) => (
              <div key={r.id} className="group overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="relative aspect-[3/4] bg-slate-50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={r.imageUrl} alt={r.customerName || "WhatsApp review"} className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => remove(r.id)}
                    disabled={deletingId === r.id}
                    className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-red-600 opacity-0 shadow transition-opacity hover:bg-white group-hover:opacity-100 disabled:opacity-50"
                    aria-label="Delete screenshot"
                    title="Delete"
                  >
                    <LuTrash2 size={15} />
                  </button>
                </div>
                {(r.customerName || r.caption) && (
                  <div className="p-3">
                    {r.customerName ? <div className="text-sm font-semibold text-slate-800">{r.customerName}</div> : null}
                    {r.caption ? <div className="mt-0.5 text-xs leading-5 text-slate-500">{r.caption}</div> : null}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
