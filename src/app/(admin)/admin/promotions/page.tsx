"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  LuCalendarClock,
  LuCopy,
  LuEye,
  LuGift,
  LuLayers,
  LuPause,
  LuPencil,
  LuPlay,
  LuPlus,
  LuReceipt,
  LuSearch,
  LuSparkles,
  LuStore,
  LuTrash2,
  LuWallet,
} from "react-icons/lu";
import AdminModal from "@/components/admin/AdminModal";
import { PROMOTION_TYPES, PROMOTION_TYPE_LABEL, type PromotionStatus } from "@/lib/promotionEngine";
import {
  CHANNEL_LABEL,
  STATUS_META,
  StatusChip,
  TypeTile,
  fetchJson,
  formatSchedule,
  omr,
  type PromotionListItem,
} from "@/components/admin/promotions/shared";

type ListData = {
  items: PromotionListItem[];
  counts: Record<"ALL" | PromotionStatus, number>;
  kpis: { active: number; liveNow: number; scheduled: number; paused: number; orders30d: number; discount30d: number; revenue30d: number };
};

const TABS: ("ALL" | PromotionStatus)[] = ["ALL", "ACTIVE", "SCHEDULED", "PAUSED", "EXPIRED", "USED_UP"];

export default function PromotionsPage() {
  const [data, setData] = useState<ListData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"ALL" | PromotionStatus>("ALL");
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [channel, setChannel] = useState("");
  const [canManage, setCanManage] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<PromotionListItem | null>(null);

  useEffect(() => {
    fetchJson<{ permissions: string[] }>("/api/auth/me").then((d) => setCanManage(!!d.data?.permissions?.includes("admin.promotions.manage")));
  }, []);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (type) params.set("type", type);
    if (channel) params.set("channel", channel);
    const d = await fetchJson<ListData>(`/api/promotions?${params}`);
    if (d.success && d.data) setData(d.data);
    setLoading(false);
  }, [search, type, channel]);

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  const patch = async (p: PromotionListItem, body: Record<string, unknown>, okMsg: string) => {
    setBusyId(p.id);
    const d = await fetchJson(`/api/promotions/${p.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setBusyId(null);
    if (!d.success) return toast.error(d.error || "Could not update");
    toast.success(okMsg);
    load();
  };

  const duplicate = async (p: PromotionListItem) => {
    setBusyId(p.id);
    const d = await fetchJson<{ id: string }>(`/api/promotions/${p.id}/duplicate`, { method: "POST" });
    setBusyId(null);
    if (!d.success) return toast.error(d.error || "Could not duplicate");
    toast.success("Copied as a paused promotion");
    load();
  };

  const remove = async () => {
    if (!toDelete) return;
    const d = await fetchJson(`/api/promotions/${toDelete.id}`, { method: "DELETE" });
    setToDelete(null);
    if (!d.success) return toast.error(d.error || "Could not delete");
    toast.success("Promotion deleted");
    load();
  };

  const items = (data?.items ?? []).filter((p) => tab === "ALL" || p.status === tab);
  const k = data?.kpis;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Promotions</h1>
          <p className="text-sm text-slate-500">Automatic deals — buy X get Y, mix &amp; match, % off and more. They apply by themselves online and at the POS; no code needed.</p>
        </div>
        {canManage && (
          <Link href="/admin/promotions/new" className="admin-btn admin-btn-primary">
            <LuPlus size={16} /> New promotion
          </Link>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi icon={LuSparkles} label="Active" value={k ? String(k.active) : "—"} sub={k ? `${k.liveNow} running right now` : ""} tone="good" />
        <Kpi icon={LuCalendarClock} label="Scheduled" value={k ? String(k.scheduled) : "—"} sub={k ? `${k.paused} paused` : ""} />
        <Kpi icon={LuReceipt} label="Orders with a deal" value={k ? k.orders30d.toLocaleString() : "—"} sub={k ? `${omr(k.revenue30d)} sales · 30 days` : ""} />
        <Kpi icon={LuWallet} label="Discount given" value={k ? omr(k.discount30d) : "—"} sub="Last 30 days" />
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mb-1">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium transition-colors ${
                tab === t ? "bg-slate-800 text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              {t === "ALL" ? "All" : STATUS_META[t].label}
              <span className={`text-xs ${tab === t ? "text-white/70" : "text-slate-400"}`}>{data?.counts[t] ?? 0}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-col sm:flex-row gap-2 lg:ml-auto">
          <div className="relative sm:w-56">
            <LuSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input className="admin-input !pl-9" placeholder="Search promotions…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className="admin-input admin-select sm:!w-44" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">All types</option>
            {PROMOTION_TYPES.map((t) => (
              <option key={t} value={t}>
                {PROMOTION_TYPE_LABEL[t].en}
              </option>
            ))}
          </select>
          <select className="admin-input admin-select sm:!w-44" value={channel} onChange={(e) => setChannel(e.target.value)}>
            <option value="">Online + POS</option>
            <option value="ONLINE">Online only</option>
            <option value="POS">POS only</option>
            <option value="ALL">Both channels</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <span className="spinner" />
        </div>
      ) : items.length === 0 ? (
        <div className="admin-card flex flex-col items-center text-center py-14 px-6">
          <span className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center mb-3">
            <LuGift size={26} />
          </span>
          <p className="font-semibold text-slate-700">{data?.counts.ALL ? "No promotions here" : "No promotions yet"}</p>
          <p className="text-sm text-slate-500 mt-1 max-w-sm">
            {data?.counts.ALL ? "Try another tab or filter." : "Create your first deal — for example “Buy 1, get 2 free” on selected dresses this weekend."}
          </p>
          {canManage && !data?.counts.ALL && (
            <Link href="/admin/promotions/new" className="admin-btn admin-btn-primary mt-4">
              <LuPlus size={16} /> New promotion
            </Link>
          )}
        </div>
      ) : (
        <div className="grid xl:grid-cols-2 gap-3">
          {items.map((p) => (
            <PromotionCard
              key={p.id}
              p={p}
              canManage={canManage}
              busy={busyId === p.id}
              onToggle={() => patch(p, { isActive: !p.isActive }, p.isActive ? "Promotion paused" : "Promotion switched on")}
              onDuplicate={() => duplicate(p)}
              onDelete={() => setToDelete(p)}
            />
          ))}
        </div>
      )}

      <AdminModal
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title="Delete promotion?"
        footer={
          <>
            <button className="admin-btn admin-btn-secondary" onClick={() => setToDelete(null)}>
              Keep it
            </button>
            <button className="admin-btn admin-btn-danger" onClick={remove}>
              <LuTrash2 size={15} /> Delete
            </button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          “{toDelete?.nameEn}” will be removed. Promotions that were already used on orders can&apos;t be deleted — pause them instead.
        </p>
      </AdminModal>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, sub, tone }: { icon: React.ElementType; label: string; value: string; sub?: string; tone?: "good" }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 p-4 flex items-start gap-3 min-w-0">
      <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${tone === "good" ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-600"}`}>
        <Icon size={20} />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-lg font-bold text-slate-800 tabular-nums truncate">{value}</p>
        {sub && <p className="text-[11px] text-slate-400 truncate">{sub}</p>}
      </div>
    </div>
  );
}

function PromotionCard({
  p,
  canManage,
  busy,
  onToggle,
  onDuplicate,
  onDelete,
}: {
  p: PromotionListItem;
  canManage: boolean;
  busy: boolean;
  onToggle: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const items =
    p.buyScope === "ALL"
      ? "All products"
      : p.buyScope === "PRODUCTS"
        ? `${p.targets.buyProducts} product${p.targets.buyProducts === 1 ? "" : "s"}`
        : `${p.targets.buyCategories} categor${p.targets.buyCategories === 1 ? "y" : "ies"}`;
  const names = p.targets.buyNames.join(", ");
  const reward =
    p.type === "BUY_X_GET_Y" && p.getScope
      ? p.getScope === "ALL"
        ? " → reward: any product"
        : ` → reward: ${p.getScope === "PRODUCTS" ? `${p.targets.getProducts} product(s)` : `${p.targets.getCategories} categor(ies)`}`
      : "";

  return (
    <div className={`admin-card p-4 flex flex-col gap-3 transition-opacity ${busy ? "opacity-60" : ""} ${p.status === "EXPIRED" ? "opacity-80" : ""}`}>
      <div className="flex items-start gap-3">
        <TypeTile type={p.type} size={44} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/admin/promotions/${p.id}`} className="font-semibold text-slate-800 hover:text-indigo-600 truncate">
              {p.nameEn}
            </Link>
            <StatusChip status={p.status} />
          </div>
          <p className="text-xs text-slate-400 truncate" dir="rtl">
            {p.nameAr}
          </p>
          <p className="text-sm text-slate-700 mt-1">
            {p.description.en}
            <span className="text-slate-400"> · {PROMOTION_TYPE_LABEL[p.type].en}</span>
          </p>
        </div>
        {p.badgeEn && <span className="hidden sm:inline-block rounded-md bg-rose-600 text-white px-2 py-0.5 text-[11px] font-semibold shrink-0 max-w-[140px] truncate">{p.badgeEn}</span>}
      </div>

      <dl className="grid sm:grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        <Meta icon={LuCalendarClock} value={formatSchedule(p)} />
        <Meta icon={LuStore} value={CHANNEL_LABEL[p.channel]} />
        <Meta icon={LuLayers} value={`${items}${names && p.buyScope !== "ALL" ? ` — ${names}${(p.targets.buyProducts + p.targets.buyCategories) > p.targets.buyNames.length ? "…" : ""}` : ""}${reward}`} />
        <Meta
          icon={LuReceipt}
          value={`Used ${p.usedCount}${p.usageLimit ? ` / ${p.usageLimit}` : ""} · saved customers ${omr(p.stats.discount)}`}
        />
      </dl>

      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100">
        <span className="text-[11px] text-slate-400">
          Priority {p.priority}
          {p.excludeSaleItems && " · skips sale items"}
          {p.maxApplicationsPerOrder && ` · max ${p.maxApplicationsPerOrder}× per order`}
        </span>
        <div className="ml-auto flex items-center gap-1">
          {canManage && p.status !== "EXPIRED" && (
            <button onClick={onToggle} disabled={busy} className="admin-btn admin-btn-secondary !py-1.5 !px-2.5 !text-xs" title={p.isActive ? "Pause" : "Switch on"}>
              {p.isActive ? <LuPause size={14} /> : <LuPlay size={14} />}
              {p.isActive ? "Pause" : "Resume"}
            </button>
          )}
          <Link href={`/admin/promotions/${p.id}`} className="admin-btn admin-btn-secondary !py-1.5 !px-2.5 !text-xs">
            {canManage ? <LuPencil size={14} /> : <LuEye size={14} />}
            {canManage ? "Edit" : "View"}
          </Link>
          {canManage && (
            <button onClick={onDuplicate} disabled={busy} className="admin-btn admin-btn-secondary !py-1.5 !px-2.5 !text-xs" title="Duplicate">
              <LuCopy size={14} />
            </button>
          )}
          {canManage && p.stats.redemptions === 0 && (
            <button onClick={onDelete} disabled={busy} className="admin-btn admin-btn-danger !py-1.5 !px-2.5 !text-xs" title="Delete">
              <LuTrash2 size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Meta({ icon: Icon, value }: { icon: React.ElementType; value: string }) {
  return (
    <div className="flex items-start gap-1.5 min-w-0">
      <Icon size={13} className="text-slate-400 mt-px shrink-0" />
      <span className="text-slate-600 min-w-0 break-words">{value}</span>
    </div>
  );
}
