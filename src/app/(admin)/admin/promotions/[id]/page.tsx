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
  const max = Math.max(1, ...series.map((s) => s.orders));
  const avgSaving = stats.redemptions ? stats.discount / stats.redemptions : 0;
  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4">
      <div className="admin-card p-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <Stat label="Orders" value={stats.redemptions.toLocaleString()} />
          <Stat label="Discount given" value={omr(stats.discount)} />
          <Stat label="Sales with deal" value={omr(stats.revenue)} />
          <Stat label="Avg saving" value={omr(avgSaving)} />
        </div>
        <p className="text-xs font-medium text-slate-500 mb-2">Orders per day · last 30 days</p>
        <div className="flex items-end gap-[3px] h-20" role="img" aria-label="Orders per day over the last 30 days">
          {series.map((s) => (
            <div key={s.day} className="flex-1 h-full flex items-end" title={`${s.day}: ${s.orders} order(s), ${s.discount.toFixed(3)} OMR off`}>
              <div className={`w-full rounded-t ${s.orders ? "bg-indigo-500" : "bg-slate-100"}`} style={{ height: `${s.orders ? Math.max(8, (s.orders / max) * 100) : 6}%` }} />
            </div>
          ))}
        </div>
        <div className="flex justify-between text-[10px] text-slate-400 mt-1">
          <span>{series[0]?.day.slice(5)}</span>
          <span>{series[series.length - 1]?.day.slice(5)}</span>
        </div>
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="font-semibold text-slate-800 tabular-nums truncate">{value}</p>
    </div>
  );
}
