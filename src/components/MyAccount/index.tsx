"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/app/context/LanguageContext";
import { normalizeWhatsApp, waLink } from "@/lib/whatsapp";

// ───────── types ─────────
type Account = {
  id: string;
  email: string | null;
  phone: string | null;
  nameEn: string | null;
  nameAr: string | null;
  createdAt: string;
  stats: { orders: number; activeOrders: number; totalSpent: number };
};
type OrderRow = {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  total: number;
  source: string;
  createdAt: string;
  itemCount: number;
  units: number;
  thumbs: string[];
  firstName: string;
};
type OrderDetail = {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  subtotal: number;
  shippingCost: number;
  discount: number;
  total: number;
  refundedAmount: number;
  shippingAddress: Record<string, string> | null;
  shippingMethod: string;
  source: string;
  createdAt: string;
  updatedAt: string;
  items: { id: string; quantity: number; unitPrice: number; total: number; nameEn: string; nameAr: string; color: string | null; size: string | null; image: string | null; slug: string }[];
  payments: { method: string; amount: number; status: string }[];
  canCancel: boolean;
};
type Address = {
  id: string;
  nameEn: string;
  phone: string;
  city: string;
  area: string | null;
  street: string | null;
  buildingNo: string | null;
  isDefault: boolean;
};
type Tab = "overview" | "orders" | "addresses" | "profile";

const STEPS = ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"] as const;

export default function MyAccount() {
  const router = useRouter();
  const { isArabic } = useLanguage();
  const t = (en: string, ar: string) => (isArabic ? ar : en);
  const [account, setAccount] = useState<Account | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [openOrder, setOpenOrder] = useState<string | null>(null);
  const [waPhone, setWaPhone] = useState("+968 9944 0312");

  const loadAccount = useCallback(async () => {
    const res = await fetch("/api/account", { cache: "no-store" });
    if (res.status === 401) {
      router.replace(`/signin?next=${encodeURIComponent("/my-account")}`);
      return;
    }
    const d = await res.json();
    if (d.success) setAccount(d.data);
  }, [router]);

  useEffect(() => {
    loadAccount();
    const sp = new URLSearchParams(window.location.search);
    const tb = sp.get("tab") as Tab | null;
    if (tb && ["overview", "orders", "addresses", "profile"].includes(tb)) setTab(tb);
    if (sp.get("order")) {
      setTab("orders");
      setOpenOrder(sp.get("order"));
    }
    fetch("/api/whatsapp-widget")
      .then((r) => r.json())
      .then((d) => d.success && setWaPhone(normalizeWhatsApp(d.data).phone))
      .catch(() => {});
  }, [loadAccount]);

  const go = (next: Tab) => {
    setTab(next);
    setOpenOrder(null);
    window.history.replaceState(null, "", `/my-account?tab=${next}`);
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.push("/");
    router.refresh();
  };

  const name = account ? (isArabic ? account.nameAr || account.nameEn : account.nameEn || account.nameAr) || t("there", "بكِ") : "";

  return (
    <main dir={isArabic ? "rtl" : "ltr"} className="pt-[73px] xl:pt-[125px] bg-[#FAF7F5] min-h-[80vh]">
      <div className="border-t border-gray-3">
        <div className="max-w-[1170px] mx-auto px-4 sm:px-8 xl:px-0 py-6 sm:py-10">
          {!account ? (
            <div className="space-y-4 animate-pulse">
              <div className="h-28 rounded-3xl bg-white" />
              <div className="h-64 rounded-3xl bg-white" />
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="rounded-3xl bg-white ring-1 ring-gray-3 p-5 sm:p-7 flex flex-col sm:flex-row sm:items-center gap-5">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <span className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-blue text-white text-xl sm:text-2xl font-semibold flex items-center justify-center shrink-0">
                    {(name || "?").trim().charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm text-dark-4">{t("Welcome back", "أهلاً بعودتكِ")}</p>
                    <h1 className="text-xl sm:text-2xl font-semibold text-dark truncate">{name}</h1>
                    <p className="text-xs text-dark-4 truncate" dir="ltr">{account.email || account.phone}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 sm:gap-3 sm:w-[360px]">
                  <Stat label={t("Orders", "الطلبات")} value={String(account.stats.orders)} />
                  <Stat label={t("In progress", "قيد التنفيذ")} value={String(account.stats.activeOrders)} />
                  <Stat label={t("Spent", "المشتريات")} value={account.stats.totalSpent.toFixed(3)} small />
                </div>
              </div>

              <div className="mt-5 grid lg:grid-cols-[240px_1fr] gap-5">
                {/* Nav */}
                <nav className="flex lg:flex-col gap-1.5 overflow-x-auto no-scrollbar -mx-4 px-4 lg:mx-0 lg:px-0 lg:sticky lg:top-[140px] lg:self-start">
                  {([
                    ["overview", t("Overview", "نظرة عامة")],
                    ["orders", t("My orders", "طلباتي")],
                    ["addresses", t("Addresses", "العناوين")],
                    ["profile", t("Profile & password", "الملف وكلمة المرور")],
                  ] as [Tab, string][]).map(([id, label]) => (
                    <button
                      key={id}
                      onClick={() => go(id)}
                      className={`shrink-0 text-start px-4 py-2.5 lg:py-3 rounded-full lg:rounded-2xl text-sm font-medium transition ${
                        tab === id ? "bg-dark text-white" : "bg-white text-dark-3 ring-1 ring-gray-3 hover:ring-dark/30"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                  <button onClick={logout} className="shrink-0 text-start px-4 py-2.5 lg:py-3 rounded-full lg:rounded-2xl text-sm font-medium text-red hover:bg-red-light-6 lg:mt-3">
                    {t("Sign out", "تسجيل الخروج")}
                  </button>
                </nav>

                <section className="min-w-0">
                  {tab === "overview" && <Overview t={t} onOpen={(id) => { setTab("orders"); setOpenOrder(id); }} goOrders={() => go("orders")} />}
                  {tab === "orders" &&
                    (openOrder ? (
                      <OrderView id={openOrder} t={t} isArabic={isArabic} waPhone={waPhone} onBack={() => setOpenOrder(null)} onChanged={loadAccount} />
                    ) : (
                      <Orders t={t} onOpen={setOpenOrder} />
                    ))}
                  {tab === "addresses" && <Addresses t={t} />}
                  {tab === "profile" && <Profile account={account} t={t} onSaved={loadAccount} />}
                </section>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

type T = (en: string, ar: string) => string;

function Stat({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div className="rounded-2xl bg-[#FAF7F5] px-3 py-2.5 text-center">
      <p className={`font-semibold text-dark tabular-nums ${small ? "text-base" : "text-lg"}`}>{value}</p>
      <p className="text-[11px] text-dark-4 truncate">{label}</p>
    </div>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-3xl bg-white ring-1 ring-gray-3 p-5 sm:p-6 ${className}`}>{children}</div>;
}

function StatusBadge({ status, t }: { status: string; t: T }) {
  const map: Record<string, [string, string, string]> = {
    PENDING: ["Received", "تم الاستلام", "bg-amber-50 text-amber-700"],
    CONFIRMED: ["Confirmed", "مؤكد", "bg-sky-50 text-sky-700"],
    PROCESSING: ["Preparing", "قيد التجهيز", "bg-violet-50 text-violet-700"],
    SHIPPED: ["On the way", "في الطريق", "bg-indigo-50 text-indigo-700"],
    DELIVERED: ["Delivered", "تم التوصيل", "bg-emerald-50 text-emerald-700"],
    CANCELLED: ["Cancelled", "ملغي", "bg-rose-50 text-rose-700"],
    REFUNDED: ["Refunded", "مسترد", "bg-slate-100 text-slate-600"],
  };
  const [en, ar, cls] = map[status] ?? [status, status, "bg-gray-2 text-dark-3"];
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${cls}`}>{t(en, ar)}</span>;
}

const fmtDate = (iso: string, ar: boolean) => new Date(iso).toLocaleDateString(ar ? "ar-OM" : "en-GB", { day: "numeric", month: "short", year: "numeric" });

function useOrders(status: string) {
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const load = useCallback(
    async (p: number) => {
      setLoading(true);
      const d = await fetch(`/api/account/orders?page=${p}&pageSize=10${status ? `&status=${status}` : ""}`, { cache: "no-store" }).then((r) => r.json()).catch(() => null);
      if (d?.success) {
        setRows((prev) => (p === 1 ? d.data.items : [...prev, ...d.data.items]));
        setHasMore(p < d.data.meta.totalPages);
        setPage(p);
      }
      setLoading(false);
    },
    [status],
  );
  useEffect(() => {
    load(1);
  }, [load]);
  return { rows, loading, hasMore, more: () => load(page + 1) };
}

function OrderCard({ o, t, onOpen }: { o: OrderRow; t: T; onOpen: (id: string) => void }) {
  const { isArabic } = useLanguage();
  return (
    <button onClick={() => onOpen(o.id)} className="w-full text-start rounded-2xl ring-1 ring-gray-3 bg-white p-4 hover:ring-dark/30 transition flex items-center gap-4">
      <div className="flex -space-x-3 rtl:space-x-reverse shrink-0">
        {(o.thumbs.length ? o.thumbs.slice(0, 3) : [null]).map((src, i) => (
          <span key={i} className="relative w-12 h-16 rounded-xl overflow-hidden ring-2 ring-white bg-[#F4EFEB]">
            {src && <Image src={src} alt="" fill sizes="48px" className="object-cover" />}
          </span>
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold text-dark text-sm">{o.orderNumber}</p>
          <StatusBadge status={o.status} t={t} />
        </div>
        <p className="text-xs text-dark-4 mt-1 truncate">
          {fmtDate(o.createdAt, isArabic)} · {o.units} {t(o.units === 1 ? "item" : "items", "قطعة")}
          {o.source === "POS" ? ` · ${t("In store", "من المتجر")}` : ""}
        </p>
      </div>
      <div className="text-end shrink-0">
        <p className="font-semibold text-dark tabular-nums">{o.total.toFixed(3)}</p>
        <p className="text-[11px] text-dark-4">{t("OMR", "ر.ع.")}</p>
      </div>
    </button>
  );
}

function Overview({ t, onOpen, goOrders }: { t: T; onOpen: (id: string) => void; goOrders: () => void }) {
  const { rows, loading } = useOrders("");
  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-dark">{t("Recent orders", "آخر الطلبات")}</h2>
          {rows.length > 0 && <button onClick={goOrders} className="text-sm text-blue font-medium">{t("View all", "عرض الكل")}</button>}
        </div>
        {loading ? (
          <div className="h-24 rounded-2xl bg-gray-1 animate-pulse" />
        ) : rows.length === 0 ? (
          <Empty t={t} />
        ) : (
          <div className="space-y-3">{rows.slice(0, 3).map((o) => <OrderCard key={o.id} o={o} t={t} onOpen={onOpen} />)}</div>
        )}
      </Card>
    </div>
  );
}

function Empty({ t }: { t: T }) {
  return (
    <div className="text-center py-10">
      <p className="font-medium text-dark">{t("No orders yet", "لا توجد طلبات بعد")}</p>
      <p className="text-sm text-dark-4 mt-1">{t("When you shop, your orders and their status appear here.", "عند الشراء ستظهر طلباتكِ وحالتها هنا.")}</p>
      <Link href="/shop" className="inline-flex mt-5 rounded-full bg-dark text-white px-6 py-3 text-sm font-semibold hover:bg-blue">
        {t("Start shopping", "ابدئي التسوق")}
      </Link>
    </div>
  );
}

function Orders({ t, onOpen }: { t: T; onOpen: (id: string) => void }) {
  const [status, setStatus] = useState("");
  const { rows, loading, hasMore, more } = useOrders(status);
  return (
    <Card>
      <div className="flex gap-2 overflow-x-auto no-scrollbar mb-5">
        {([["", t("All", "الكل")], ["active", t("In progress", "قيد التنفيذ")], ["completed", t("Delivered", "تم التوصيل")], ["cancelled", t("Cancelled", "ملغاة")]] as [string, string][]).map(([v, l]) => (
          <button key={v} onClick={() => setStatus(v)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium ${status === v ? "bg-dark text-white" : "bg-gray-1 text-dark-3"}`}>
            {l}
          </button>
        ))}
      </div>
      {rows.length === 0 && !loading ? (
        <Empty t={t} />
      ) : (
        <div className="space-y-3">
          {rows.map((o) => <OrderCard key={o.id} o={o} t={t} onOpen={onOpen} />)}
          {loading && <div className="h-20 rounded-2xl bg-gray-1 animate-pulse" />}
          {hasMore && !loading && (
            <button onClick={more} className="w-full py-3 text-sm font-medium text-blue">{t("Load more", "عرض المزيد")}</button>
          )}
        </div>
      )}
    </Card>
  );
}

function OrderView({ id, t, isArabic, waPhone, onBack, onChanged }: { id: string; t: T; isArabic: boolean; waPhone: string; onBack: () => void; onChanged: () => void }) {
  const [o, setO] = useState<OrderDetail | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/account/orders/${id}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => (d.success ? setO(d.data) : setErr(d.error || "Not found")))
      .catch(() => setErr("Could not load the order"));
  }, [id]);
  useEffect(load, [load]);

  const cancel = async () => {
    if (!confirm(t("Cancel this order?", "هل تريدين إلغاء هذا الطلب؟"))) return;
    setBusy(true);
    const d = await fetch(`/api/account/orders/${id}/cancel`, { method: "POST" }).then((r) => r.json()).catch(() => null);
    setBusy(false);
    if (!d?.success) return setErr(d?.error || "Could not cancel");
    load();
    onChanged();
  };

  if (err) return <Card><p className="text-red text-sm">{err}</p><button onClick={onBack} className="mt-3 text-sm text-blue">{t("Back", "رجوع")}</button></Card>;
  if (!o) return <div className="h-72 rounded-3xl bg-white animate-pulse" />;

  const stopped = o.status === "CANCELLED" || o.status === "REFUNDED";
  const stepIndex = STEPS.indexOf(o.status as (typeof STEPS)[number]);
  const stepLabels: Record<string, [string, string]> = {
    PENDING: ["Order placed", "تم الطلب"],
    CONFIRMED: ["Confirmed", "مؤكد"],
    PROCESSING: ["Preparing", "قيد التجهيز"],
    SHIPPED: ["On the way", "في الطريق"],
    DELIVERED: ["Delivered", "تم التوصيل"],
  };
  const addr = o.shippingAddress || {};

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-dark-3 hover:text-dark">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="rtl:-scale-x-100" aria-hidden><path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
        {t("All orders", "كل الطلبات")}
      </button>

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs text-dark-4">{t("Order", "طلب")}</p>
            <h2 className="text-xl font-semibold text-dark">{o.orderNumber}</h2>
            <p className="text-sm text-dark-4 mt-0.5">{fmtDate(o.createdAt, isArabic)}</p>
          </div>
          <StatusBadge status={o.status} t={t} />
        </div>

        {/* Tracker */}
        {o.source !== "POS" && (
          stopped ? (
            <p className="mt-6 rounded-2xl bg-rose-50 text-rose-700 px-4 py-3 text-sm">
              {o.status === "CANCELLED" ? t("This order was cancelled.", "تم إلغاء هذا الطلب.") : t("This order was refunded.", "تم استرداد قيمة هذا الطلب.")}
            </p>
          ) : (
            <ol className="mt-7 grid grid-cols-5 gap-1">
              {STEPS.map((s, i) => {
                const done = i <= stepIndex;
                return (
                  <li key={s} className="flex flex-col items-center text-center">
                    <div className="relative w-full flex items-center justify-center">
                      {i > 0 && <span className={`absolute end-1/2 w-full h-0.5 ${i <= stepIndex ? "bg-blue" : "bg-gray-3"}`} />}
                      <span className={`relative z-10 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${done ? "bg-blue text-white" : "bg-gray-2 text-dark-4"} ${i === stepIndex ? "ring-4 ring-blue/15" : ""}`}>
                        {done ? "✓" : i + 1}
                      </span>
                    </div>
                    <span className={`mt-2 text-[10.5px] sm:text-xs leading-tight ${done ? "text-dark font-medium" : "text-dark-4"}`}>{t(...stepLabels[s])}</span>
                  </li>
                );
              })}
            </ol>
          )
        )}
      </Card>

      <Card>
        <h3 className="font-semibold text-dark mb-4">{t("Items", "المنتجات")}</h3>
        <ul className="divide-y divide-gray-3">
          {o.items.map((it) => (
            <li key={it.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              <Link href={`/shop-details?slug=${it.slug}`} className="relative w-14 h-[72px] rounded-xl overflow-hidden bg-[#F4EFEB] shrink-0">
                {it.image && <Image src={it.image} alt="" fill sizes="56px" className="object-cover" />}
              </Link>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-dark line-clamp-2">{isArabic ? it.nameAr || it.nameEn : it.nameEn}</p>
                <p className="text-xs text-dark-4 mt-0.5">
                  {[it.color, it.size].filter(Boolean).join(" · ")}
                  {(it.color || it.size) && " · "}× {it.quantity}
                </p>
              </div>
              <p className="text-sm font-semibold text-dark tabular-nums">{it.total.toFixed(3)}</p>
            </li>
          ))}
        </ul>
        <dl className="mt-5 pt-4 border-t border-gray-3 space-y-1.5 text-sm">
          <Row label={t("Subtotal", "المجموع الفرعي")} value={o.subtotal} />
          {o.discount > 0 && <Row label={t("Discount", "الخصم")} value={-o.discount} />}
          {o.shippingCost > 0 && <Row label={t("Delivery", "التوصيل")} value={o.shippingCost} />}
          <div className="flex justify-between font-semibold text-dark text-base pt-1">
            <dt>{t("Total", "الإجمالي")}</dt>
            <dd className="tabular-nums">{o.total.toFixed(3)} {t("OMR", "ر.ع.")}</dd>
          </div>
          {o.refundedAmount > 0 && <Row label={t("Refunded", "المسترد")} value={-o.refundedAmount} />}
        </dl>
      </Card>

      <div className="grid sm:grid-cols-2 gap-4">
        {o.source !== "POS" && (
          <Card>
            <h3 className="font-semibold text-dark mb-2">{t("Delivery", "التوصيل")}</h3>
            <p className="text-sm text-dark-3 leading-relaxed">
              {[addr.nameEn, addr.phone, addr.city, addr.area, addr.street].filter(Boolean).join("، ")}
            </p>
          </Card>
        )}
        <Card>
          <h3 className="font-semibold text-dark mb-2">{t("Payment", "الدفع")}</h3>
          <p className="text-sm text-dark-3">
            {o.payments.map((p) => p.method.replace(/_/g, " ").toLowerCase()).join(" + ")} ·{" "}
            {o.paymentStatus === "PAID" ? t("Paid", "مدفوع") : o.paymentStatus === "REFUNDED" ? t("Refunded", "مسترد") : t("Not paid yet", "غير مدفوع بعد")}
          </p>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <a
          href={waLink(waPhone, `${t("Hello, about my order", "مرحباً، بخصوص طلبي")} ${o.orderNumber}`)}
          target="_blank"
          rel="noreferrer"
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-[#25D366] text-white font-semibold py-3.5 hover:bg-[#1ebe5a]"
        >
          {t("Ask about this order on WhatsApp", "استفسري عن الطلب عبر واتساب")}
        </a>
        {o.canCancel && (
          <button onClick={cancel} disabled={busy} className="sm:w-48 rounded-full ring-1 ring-red/40 text-red font-semibold py-3.5 hover:bg-red-light-6 disabled:opacity-50">
            {busy ? "…" : t("Cancel order", "إلغاء الطلب")}
          </button>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between text-dark-3">
      <dt>{label}</dt>
      <dd className="tabular-nums">{value.toFixed(3)}</dd>
    </div>
  );
}

const inputCls = "w-full h-12 rounded-2xl border border-gray-3 bg-white px-4 text-[16px] text-dark outline-none focus:border-dark focus:ring-4 focus:ring-dark/5";

function Field({ label, ...p }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-dark mb-1.5">{label}</span>
      <input {...p} className={inputCls} />
    </label>
  );
}

function Notice({ msg }: { msg: { ok: boolean; text: string } | null }) {
  if (!msg) return null;
  return <p className={`text-sm rounded-2xl px-4 py-3 ${msg.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-light-6 text-red-dark"}`}>{msg.text}</p>;
}

function Addresses({ t }: { t: T }) {
  const [items, setItems] = useState<Address[] | null>(null);
  const [editing, setEditing] = useState<Partial<Address> | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const load = useCallback(() => {
    fetch("/api/account/addresses", { cache: "no-store" }).then((r) => r.json()).then((d) => d.success && setItems(d.data));
  }, []);
  useEffect(load, [load]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    const isNew = !editing.id;
    const d = await fetch(isNew ? "/api/account/addresses" : `/api/account/addresses/${editing.id}`, {
      method: isNew ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editing),
    }).then((r) => r.json());
    if (!d.success) return setMsg({ ok: false, text: d.error });
    setEditing(null);
    setMsg(null);
    load();
  };
  const remove = async (a: Address) => {
    if (!confirm(t("Delete this address?", "حذف هذا العنوان؟"))) return;
    await fetch(`/api/account/addresses/${a.id}`, { method: "DELETE" });
    load();
  };
  const makeDefault = async (a: Address) => {
    await fetch(`/api/account/addresses/${a.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isDefault: true }) });
    load();
  };

  if (editing) {
    const set = (k: keyof Address, v: string) => setEditing({ ...editing, [k]: v });
    return (
      <Card>
        <h2 className="font-semibold text-dark mb-5">{editing.id ? t("Edit address", "تعديل العنوان") : t("New address", "عنوان جديد")}</h2>
        <form onSubmit={save} className="grid sm:grid-cols-2 gap-4">
          <Field label={t("Recipient name", "اسم المستلم")} value={editing.nameEn ?? ""} onChange={(e) => set("nameEn", e.target.value)} required />
          <Field label={t("Mobile", "الجوال")} value={editing.phone ?? ""} onChange={(e) => set("phone", e.target.value)} required inputMode="tel" dir="ltr" />
          <Field label={t("City / Wilayat", "المدينة / الولاية")} value={editing.city ?? ""} onChange={(e) => set("city", e.target.value)} required />
          <Field label={t("Area", "المنطقة")} value={editing.area ?? ""} onChange={(e) => set("area", e.target.value)} />
          <Field label={t("Street / Way", "الشارع / السكة")} value={editing.street ?? ""} onChange={(e) => set("street", e.target.value)} />
          <Field label={t("House / building no.", "رقم المنزل / المبنى")} value={editing.buildingNo ?? ""} onChange={(e) => set("buildingNo", e.target.value)} />
          <div className="sm:col-span-2"><Notice msg={msg} /></div>
          <div className="sm:col-span-2 flex gap-3">
            <button className="rounded-full bg-dark text-white font-semibold px-7 py-3 hover:bg-blue">{t("Save address", "حفظ العنوان")}</button>
            <button type="button" onClick={() => { setEditing(null); setMsg(null); }} className="rounded-full ring-1 ring-gray-3 px-6 py-3 text-dark-3">{t("Cancel", "إلغاء")}</button>
          </div>
        </form>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-semibold text-dark">{t("Saved addresses", "العناوين المحفوظة")}</h2>
        <button onClick={() => setEditing({})} className="rounded-full bg-dark text-white text-sm font-semibold px-4 py-2 hover:bg-blue">+ {t("Add", "إضافة")}</button>
      </div>
      {!items ? (
        <div className="h-24 rounded-2xl bg-gray-1 animate-pulse" />
      ) : items.length === 0 ? (
        <p className="text-sm text-dark-4 py-6 text-center">{t("No saved addresses yet.", "لا توجد عناوين محفوظة.")}</p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {items.map((a) => (
            <div key={a.id} className={`rounded-2xl p-4 ring-1 ${a.isDefault ? "ring-dark" : "ring-gray-3"}`}>
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium text-dark">{a.nameEn}</p>
                {a.isDefault && <span className="text-[11px] font-semibold rounded-full bg-dark text-white px-2 py-0.5">{t("Default", "الافتراضي")}</span>}
              </div>
              <p className="text-sm text-dark-3 mt-1 leading-relaxed">{[a.city, a.area, a.street, a.buildingNo].filter(Boolean).join("، ")}</p>
              <p className="text-sm text-dark-4 mt-0.5" dir="ltr">{a.phone}</p>
              <div className="flex gap-4 mt-3 text-sm">
                <button onClick={() => setEditing(a)} className="text-blue font-medium">{t("Edit", "تعديل")}</button>
                {!a.isDefault && <button onClick={() => makeDefault(a)} className="text-dark-3">{t("Make default", "جعله افتراضياً")}</button>}
                <button onClick={() => remove(a)} className="text-red ms-auto">{t("Delete", "حذف")}</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function Profile({ account, t, onSaved }: { account: Account; t: T; onSaved: () => void }) {
  const [form, setForm] = useState({ nameEn: account.nameEn || "", email: account.email || "", phone: account.phone || "" });
  const [pw, setPw] = useState({ currentPassword: "", newPassword: "" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const d = await fetch("/api/account", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) }).then((r) => r.json());
    setMsg(d.success ? { ok: true, text: t("Profile saved", "تم حفظ الملف") } : { ok: false, text: d.error });
    if (d.success) onSaved();
  };
  const savePw = async (e: React.FormEvent) => {
    e.preventDefault();
    const d = await fetch("/api/account/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(pw) }).then((r) => r.json());
    setPwMsg(d.success ? { ok: true, text: t("Password changed", "تم تغيير كلمة المرور") } : { ok: false, text: d.error });
    if (d.success) setPw({ currentPassword: "", newPassword: "" });
  };

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="font-semibold text-dark mb-5">{t("Personal details", "البيانات الشخصية")}</h2>
        <form onSubmit={saveProfile} className="grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2"><Field label={t("Full name", "الاسم الكامل")} value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} required /></div>
          <Field label={t("Email", "البريد الإلكتروني")} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} dir="ltr" placeholder="name@email.com" />
          <Field label={t("Mobile", "الجوال")} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} dir="ltr" inputMode="tel" />
          <div className="sm:col-span-2"><Notice msg={msg} /></div>
          <div className="sm:col-span-2"><button className="rounded-full bg-dark text-white font-semibold px-7 py-3 hover:bg-blue">{t("Save changes", "حفظ التغييرات")}</button></div>
        </form>
      </Card>
      <Card>
        <h2 className="font-semibold text-dark mb-5">{t("Change password", "تغيير كلمة المرور")}</h2>
        <form onSubmit={savePw} className="grid sm:grid-cols-2 gap-4">
          <Field label={t("Current password", "كلمة المرور الحالية")} type="password" autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} required dir="ltr" />
          <Field label={t("New password", "كلمة المرور الجديدة")} type="password" autoComplete="new-password" minLength={6} value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} required dir="ltr" />
          <div className="sm:col-span-2"><Notice msg={pwMsg} /></div>
          <div className="sm:col-span-2"><button className="rounded-full bg-dark text-white font-semibold px-7 py-3 hover:bg-blue">{t("Update password", "تحديث كلمة المرور")}</button></div>
        </form>
      </Card>
    </div>
  );
}
