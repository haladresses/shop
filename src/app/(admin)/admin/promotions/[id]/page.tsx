"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { LuChevronLeft } from "react-icons/lu";
import PromotionEditor from "@/components/admin/promotions/PromotionEditor";
import { StatusChip, TypeTile, fetchJson, omr, type PromotionDetail } from "@/components/admin/promotions/shared";

export default function PromotionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [detail, setDetail] = useState<PromotionDetail | null>(null);
  const [error, setError] = useState("");
  const [canManage, setCanManage] = useState(false);
  // Remount the editor after a save so it reflects the stored, normalised promotion.
  const [version, setVersion] = useState(0);

  const load = useCallback(async () => {
    const d = await fetchJson<PromotionDetail>(`/api/promotions/${id}`);
    if (d.success && d.data) {
      setDetail(d.data);
      setVersion((v) => v + 1);
    } else setError(d.error || "Promotion not found");
  }, [id]);

  useEffect(() => {
    load();
    fetchJson<{ permissions: string[] }>("/api/auth/me").then((d) => setCanManage(!!d.data?.permissions?.includes("admin.promotions.manage")));
  }, [load]);

  if (error) {
    return (
      <div className="admin-card p-8 text-center">
        <p className="text-slate-600">{error}</p>
        <Link href="/admin/promotions" className="admin-btn admin-btn-secondary mt-4">
          Back to promotions
        </Link>
      </div>
    );
  }
  if (!detail) {
    return (
      <div className="flex justify-center py-16">
        <span className="spinner" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <Link href="/admin/promotions" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-1">
          <LuChevronLeft size={16} /> Promotions
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <TypeTile type={detail.type} />
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-slate-800 truncate">{detail.nameEn}</h1>
            <p className="text-sm text-slate-500">{detail.description.en}</p>
          </div>
          <StatusChip status={detail.status} />
        </div>
      </div>

      <Performance detail={detail} />

      <PromotionEditor key={version} initial={detail} canManage={canManage} onSaved={load} />
    </div>
  );
}

function Performance({ detail }: { detail: PromotionDetail }) {
  const { stats, series, recent } = detail;
  const avgSaving = stats.redemptions ? stats.discount / stats.redemptions : 0;
  // Only the days the deal was actually used, newest first.
  const activeDays = series.filter((s) => s.orders > 0).reverse();
  const days30 = activeDays.reduce((t, s) => ({ orders: t.orders + s.orders, discount: t.discount + s.discount }), { orders: 0, discount: 0 });
  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4 items-start">
      <div className="admin-card">
        <p className="px-4 pt-4 pb-2 text-sm font-semibold text-slate-700">All time</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-4 pb-4">
          <Stat label="Orders" value={stats.redemptions.toLocaleString()} />
          <Stat label="Discount given" value={omr(stats.discount)} />
          <Stat label="Sales with deal" value={omr(stats.revenue)} />
          <Stat label="Average saving" value={omr(avgSaving)} />
        </div>
        <p className="px-4 pt-3 pb-2 text-sm font-semibold text-slate-700 border-t border-slate-100">Last 30 days, by day</p>
        {activeDays.length === 0 ? (
          <p className="px-4 pb-6 text-sm text-slate-400">Not used in the last 30 days.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="admin-table tabular-nums">
              <thead>
                <tr>
                  <th>Date</th>
                  <th className="text-right">Orders</th>
                  <th className="text-right">Discount given (OMR)</th>
                </tr>
              </thead>
              <tbody>
                {activeDays.map((s) => (
                  <tr key={s.day}>
                    <td className="whitespace-nowrap">{dayName(s.day)}</td>
                    <td className="text-right">{s.orders}</td>
                    <td className="text-right">{s.discount.toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100">
                  <td className="font-bold text-slate-900 border-t-2 border-slate-300">Total, 30 days</td>
                  <td className="text-right font-bold text-slate-900 border-t-2 border-slate-300">{days30.orders}</td>
                  <td className="text-right font-bold text-slate-900 border-t-2 border-slate-300">{days30.discount.toFixed(3)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      <div className="admin-card overflow-hidden">
        <p className="px-4 pt-4 pb-2 text-sm font-semibold text-slate-700">Recent orders</p>
        {recent.length === 0 ? (
          <p className="px-4 pb-6 text-sm text-slate-400">Not used on any order yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th className="text-right">Saved</th>
                  <th className="text-right">Order total</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <p className="font-medium text-slate-800">{r.order.orderNumber}</p>
                      <p className="text-[11px] text-slate-400">
                        {new Date(r.createdAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })} · {r.order.source === "POS" ? "POS" : "Online"}
                      </p>
                    </td>
                    <td className="text-slate-600">{r.order.customer || "-"}</td>
                    <td className="text-right tabular-nums text-emerald-700">−{r.discount.toFixed(3)}</td>
                    <td className="text-right tabular-nums">{r.order.total.toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/** "2026-11-16" → "Mon 16 Nov 2026" */
function dayName(key: string) {
  return new Date(`${key}T12:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="font-semibold text-slate-800 tabular-nums break-words">{value}</p>
    </div>
  );
}
