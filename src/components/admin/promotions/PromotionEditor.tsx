"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  LuCalendar,
  LuCheck,
  LuCircleAlert,
  LuClock,
  LuGlobe,
  LuInfo,
  LuLayers,
  LuLoaderCircle,
  LuMonitorSmartphone,
  LuPlus,
  LuSave,
  LuStore,
  LuTag,
  LuTrash2,
  LuWand,
  LuX,
} from "react-icons/lu";
import AdminModal from "@/components/admin/AdminModal";
import {
  PROMOTION_TYPES,
  PROMOTION_TYPE_LABEL,
  describePromotion,
  promotionStatus,
  type PromotionRule,
  type PromotionTypeKey,
} from "@/lib/promotionEngine";
import { localToDate, normalizePromotion, promotionInputSchema, type PromotionInput } from "@/lib/validations/promotion";
import CategoryPicker from "./CategoryPicker";
import ProductPickerModal from "./ProductPickerModal";
import PromotionSimulator from "./PromotionSimulator";
import {
  CHANNEL_LABEL,
  DAY_SHORT,
  StatusChip,
  TYPE_META,
  buildAncestry,
  fetchJson,
  formatSchedule,
  type CategoryNode,
  type PickerProduct,
  type PromotionDetail,
} from "./shared";

type Scope = "ALL" | "PRODUCTS" | "CATEGORIES";

type FormState = {
  type: PromotionTypeKey;
  nameEn: string;
  nameAr: string;
  descriptionEn: string;
  descriptionAr: string;
  badgeEn: string;
  badgeAr: string;
  /** Keep the badge in sync with the rule until the admin types their own. */
  badgeAuto: boolean;
  channel: "ALL" | "ONLINE" | "POS";
  isActive: boolean;
  startsAt: string;
  endsAt: string;
  daysOfWeek: number[];
  timeWindow: boolean;
  startTime: string;
  endTime: string;
  priority: string;
  discountPercent: string;
  discountAmount: string;
  fixedPrice: string;
  buyQuantity: string;
  getQuantity: string;
  minSpend: string;
  rewardMode: "free" | "percent";
  thresholdMode: "percent" | "amount";
  maxApplicationsPerOrder: string;
  usageLimit: string;
  buyScope: Scope;
  getScope: "SAME" | Scope;
  excludeSaleItems: boolean;
  buyProducts: PickerProduct[];
  getProducts: PickerProduct[];
  buyCategoryIds: string[];
  getCategoryIds: string[];
};

const EMPTY: FormState = {
  type: "BUY_X_GET_Y",
  nameEn: "",
  nameAr: "",
  descriptionEn: "",
  descriptionAr: "",
  badgeEn: "",
  badgeAr: "",
  badgeAuto: true,
  channel: "ALL",
  isActive: true,
  startsAt: "",
  endsAt: "",
  daysOfWeek: [],
  timeWindow: false,
  startTime: "18:00",
  endTime: "22:00",
  priority: "0",
  discountPercent: "",
  discountAmount: "",
  fixedPrice: "",
  buyQuantity: "1",
  getQuantity: "2",
  minSpend: "",
  rewardMode: "free",
  thresholdMode: "percent",
  maxApplicationsPerOrder: "",
  usageLimit: "",
  buyScope: "PRODUCTS",
  getScope: "SAME",
  excludeSaleItems: false,
  buyProducts: [],
  getProducts: [],
  buyCategoryIds: [],
  getCategoryIds: [],
};

const s = (v: number | null | undefined) => (v == null ? "" : String(v));

function fromDetail(d: PromotionDetail): FormState {
  return {
    type: d.type,
    nameEn: d.nameEn,
    nameAr: d.nameAr,
    descriptionEn: d.descriptionEn ?? "",
    descriptionAr: d.descriptionAr ?? "",
    badgeEn: d.badgeEn ?? "",
    badgeAr: d.badgeAr ?? "",
    badgeAuto: !d.badgeEn && !d.badgeAr,
    channel: d.channel,
    isActive: d.isActive,
    startsAt: d.startsAtLocal,
    endsAt: d.endsAtLocal,
    daysOfWeek: d.daysOfWeek ?? [],
    timeWindow: !!(d.startTime && d.endTime),
    startTime: d.startTime ?? "18:00",
    endTime: d.endTime ?? "22:00",
    priority: String(d.priority),
    discountPercent: d.type === "BUY_X_GET_Y" && (d.discountPercent ?? 100) >= 100 ? "" : s(d.discountPercent),
    discountAmount: s(d.discountAmount),
    fixedPrice: s(d.fixedPrice),
    buyQuantity: s(d.buyQuantity),
    getQuantity: s(d.getQuantity),
    minSpend: s(d.minSpend),
    rewardMode: d.type === "BUY_X_GET_Y" && (d.discountPercent ?? 100) < 100 ? "percent" : "free",
    thresholdMode: d.type === "ORDER_THRESHOLD" && d.discountAmount ? "amount" : "percent",
    maxApplicationsPerOrder: s(d.maxApplicationsPerOrder),
    usageLimit: s(d.usageLimit),
    buyScope: d.buyScope,
    getScope: d.getScope ?? "SAME",
    excludeSaleItems: d.excludeSaleItems,
    buyProducts: d.buyProducts,
    getProducts: d.getProducts,
    buyCategoryIds: d.buyCategories.map((c) => c.id),
    getCategoryIds: d.getCategories.map((c) => c.id),
  };
}

const numOrNull = (v: string) => (v.trim() === "" || Number.isNaN(Number(v)) ? null : Number(v));
const intOrNull = (v: string) => (v.trim() === "" || Number.isNaN(parseInt(v)) ? null : parseInt(v));

function toPayload(f: FormState): PromotionInput {
  const t = f.type;
  return {
    nameEn: f.nameEn,
    nameAr: f.nameAr,
    descriptionEn: f.descriptionEn,
    descriptionAr: f.descriptionAr,
    badgeEn: f.badgeEn,
    badgeAr: f.badgeAr,
    type: t,
    channel: f.channel,
    isActive: f.isActive,
    startsAt: f.startsAt || null,
    endsAt: f.endsAt || null,
    daysOfWeek: f.daysOfWeek.length ? f.daysOfWeek : null,
    startTime: f.timeWindow ? f.startTime || null : null,
    endTime: f.timeWindow ? f.endTime || null : null,
    priority: intOrNull(f.priority) ?? 0,
    discountPercent:
      t === "BUY_X_GET_Y"
        ? f.rewardMode === "free"
          ? 100
          : numOrNull(f.discountPercent)
        : t === "ORDER_THRESHOLD"
          ? f.thresholdMode === "percent"
            ? numOrNull(f.discountPercent)
            : null
          : numOrNull(f.discountPercent),
    discountAmount: t === "ORDER_THRESHOLD" && f.thresholdMode === "percent" ? null : numOrNull(f.discountAmount),
    fixedPrice: numOrNull(f.fixedPrice),
    buyQuantity: intOrNull(f.buyQuantity),
    getQuantity: intOrNull(f.getQuantity),
    minSpend: numOrNull(f.minSpend),
    maxApplicationsPerOrder: intOrNull(f.maxApplicationsPerOrder),
    usageLimit: intOrNull(f.usageLimit),
    buyScope: f.buyScope,
    getScope: t === "BUY_X_GET_Y" && f.getScope !== "SAME" ? f.getScope : null,
    excludeSaleItems: f.excludeSaleItems,
    buyProductIds: f.buyProducts.map((p) => p.id),
    buyCategoryIds: f.buyCategoryIds,
    getProductIds: f.getProducts.map((p) => p.id),
    getCategoryIds: f.getCategoryIds,
  };
}

// ── shop-time helpers (Oman, UTC+4, no DST) ──
const pad = (n: number) => String(n).padStart(2, "0");
const shopNow = () => new Date(Date.now() + 4 * 3600 * 1000);
const dayKey = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const plusDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);

function preset(kind: "now" | "today" | "weekend" | "week" | "month"): { startsAt: string; endsAt?: string } {
  const now = shopNow();
  const nowLocal = `${dayKey(now)}T${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}`;
  switch (kind) {
    case "now":
      return { startsAt: nowLocal };
    case "today":
      return { startsAt: `${dayKey(now)}T00:00`, endsAt: `${dayKey(now)}T23:59` };
    case "weekend": {
      // Oman's weekend is Friday–Saturday.
      const dow = now.getUTCDay();
      const start = dow === 5 || dow === 6 ? now : plusDays(now, (5 - dow + 7) % 7);
      const end = plusDays(start, 6 - start.getUTCDay());
      return { startsAt: `${dayKey(start)}T00:00`, endsAt: `${dayKey(end)}T23:59` };
    }
    case "week":
      return { startsAt: nowLocal, endsAt: `${dayKey(plusDays(now, 6))}T23:59` };
    case "month": {
      const last = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
      return { startsAt: `${dayKey(now)}T00:00`, endsAt: `${dayKey(last)}T23:59` };
    }
  }
}

const COMBINE_RULES = [
  "Item deals (% off, amount off, fixed price, buy X get Y, mix & match) run in priority order. Highest number first.",
  "Each item in the basket can be used by only one item deal: whichever claims it first.",
  "Then at most one “Spend & save” deal applies. The one that saves the customer most. On top of item deals.",
  "Buy X get Y and mix & match use the most expensive qualifying items first; in buy X get Y the cheaper items in each set are the reward.",
];

export default function PromotionEditor({
  initial,
  canManage,
  onSaved,
}: {
  initial?: PromotionDetail | null;
  canManage: boolean;
  onSaved?: () => void;
}) {
  const router = useRouter();
  const [f, setF] = useState<FormState>(() => (initial ? fromDetail(initial) : EMPTY));
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [picker, setPicker] = useState<null | "buy" | "get">(null);
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((prev) => ({ ...prev, [k]: v }));

  useEffect(() => {
    fetchJson<CategoryNode[]>("/api/categories?tree=true").then((d) => d.success && d.data && setCategories(d.data));
  }, []);
  const ancestry = useMemo(() => buildAncestry(categories), [categories]);

  const payload = useMemo(() => toPayload(f), [f]);
  const parsed = useMemo(() => promotionInputSchema.safeParse(payload), [payload]);
  const issues = useMemo(() => {
    const out: Record<string, string> = {};
    if (!parsed.success) {
      for (const i of parsed.error.issues) {
        const key = String(i.path[0] ?? "form");
        if (!out[key]) out[key] = i.message;
      }
    }
    return out;
  }, [parsed]);
  const err = (k: string) => (showErrors ? issues[k] : undefined);

  const sentence = describePromotion({
    type: f.type,
    discountPercent: payload.discountPercent ?? null,
    discountAmount: payload.discountAmount ?? null,
    fixedPrice: payload.fixedPrice ?? null,
    buyQuantity: payload.buyQuantity ?? null,
    getQuantity: payload.getQuantity ?? null,
    minSpend: payload.minSpend ?? null,
  });

  // Auto badge follows the rule until the admin writes their own.
  useEffect(() => {
    if (!f.badgeAuto) return;
    const en = sentence.en.slice(0, 40);
    const ar = sentence.ar.slice(0, 40);
    setF((prev) => (prev.badgeEn === en && prev.badgeAr === ar ? prev : { ...prev, badgeEn: en, badgeAr: ar }));
  }, [f.badgeAuto, sentence.en, sentence.ar]);

  /** The draft as an engine rule (placeholder names so the simulator works before naming). */
  const draftRule = useMemo<PromotionRule | null>(() => {
    const r = promotionInputSchema.safeParse({ ...payload, nameEn: payload.nameEn || "Draft", nameAr: payload.nameAr || "مسودة" });
    if (!r.success) return null;
    const n = normalizePromotion(r.data);
    return {
      id: initial?.id ?? "draft",
      nameEn: n.nameEn,
      nameAr: n.nameAr,
      badgeEn: n.badgeEn,
      badgeAr: n.badgeAr,
      type: n.type,
      channel: n.channel,
      isActive: n.isActive,
      startsAt: n.startsAt ? localToDate(n.startsAt).toISOString() : null,
      endsAt: n.endsAt ? localToDate(n.endsAt).toISOString() : null,
      daysOfWeek: n.daysOfWeek,
      startTime: n.startTime,
      endTime: n.endTime,
      priority: n.priority,
      discountPercent: n.discountPercent,
      discountAmount: n.discountAmount,
      fixedPrice: n.fixedPrice,
      buyQuantity: n.buyQuantity,
      getQuantity: n.getQuantity,
      minSpend: n.minSpend,
      maxApplicationsPerOrder: n.maxApplicationsPerOrder,
      usageLimit: n.usageLimit,
      usedCount: initial?.usedCount ?? 0,
      buyScope: n.buyScope,
      getScope: n.getScope,
      excludeSaleItems: n.excludeSaleItems,
      buyProductIds: n.buyProductIds,
      buyCategoryIds: n.buyCategoryIds,
      getProductIds: n.getProductIds,
      getCategoryIds: n.getCategoryIds,
    };
  }, [payload, initial]);

  const status = promotionStatus({
    isActive: f.isActive,
    startsAt: f.startsAt ? localToDate(f.startsAt).toISOString() : null,
    endsAt: f.endsAt ? localToDate(f.endsAt).toISOString() : null,
    usageLimit: intOrNull(f.usageLimit),
    usedCount: initial?.usedCount ?? 0,
  });

  const save = async () => {
    setShowErrors(true);
    if (!parsed.success) {
      const n = Object.keys(issues).length;
      toast.error(`Please fix ${n} thing${n === 1 ? "" : "s"} highlighted below`);
      const first = Object.keys(issues)[0];
      document.querySelector(`[data-field="${first}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setSaving(true);
    const d = await fetchJson<{ id: string }>(initial ? `/api/promotions/${initial.id}` : "/api/promotions", {
      method: initial ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (!d.success || !d.data) {
      toast.error(d.error || "Could not save the promotion");
      return;
    }
    toast.success(initial ? "Promotion saved" : "Promotion created");
    if (initial) onSaved?.();
    else router.push(`/admin/promotions/${d.data.id}`);
  };

  const remove = async () => {
    if (!initial) return;
    const d = await fetchJson(`/api/promotions/${initial.id}`, { method: "DELETE" });
    setConfirmDelete(false);
    if (!d.success) return toast.error(d.error || "Could not delete");
    toast.success("Promotion deleted");
    router.push("/admin/promotions");
  };

  const t = f.type;
  const isBxgy = t === "BUY_X_GET_Y";
  const onSaleSelected = f.buyProducts.filter((p) => p.onSale).length;

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-5 items-start">
      <fieldset disabled={!canManage} className="space-y-5 min-w-0">
        {/* 1 — Type */}
        <Section n={1} title="Type of deal" desc="What kind of promotion is this?">
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {PROMOTION_TYPES.map((type) => {
              const m = TYPE_META[type];
              const Icon = m.icon;
              const on = t === type;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => set("type", type)}
                  className={`text-left rounded-2xl border p-3.5 transition-all ${
                    on ? "border-indigo-500 ring-2 ring-indigo-100 bg-indigo-50/40" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-2.5 mb-2">
                    <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${m.tile}`}>
                      <Icon size={18} />
                    </span>
                    <span className="font-semibold text-slate-800 text-sm">{PROMOTION_TYPE_LABEL[type].en}</span>
                    {on && <LuCheck className="ml-auto text-indigo-600" size={18} />}
                  </div>
                  <p className="text-xs text-slate-500">{PROMOTION_TYPE_LABEL[type].hint}</p>
                  <p className="text-[11px] text-slate-400 mt-1">e.g. {m.examples.join(" · ")}</p>
                </button>
              );
            })}
          </div>
        </Section>

        {/* 2 — Rule */}
        <Section n={2} title="The deal" desc="Set the numbers: the sentence below shows exactly what customers get.">
          <div className="space-y-4">
            {t === "PERCENT_OFF" && (
              <Field label="Discount" name="discountPercent" error={err("discountPercent")}>
                <Suffixed suffix="% off each item">
                  <input type="number" min="0" max="100" step="0.01" className="admin-input" value={f.discountPercent} onChange={(e) => set("discountPercent", e.target.value)} placeholder="20" />
                </Suffixed>
              </Field>
            )}
            {t === "AMOUNT_OFF" && (
              <Field label="Amount off" name="discountAmount" error={err("discountAmount")}>
                <Suffixed suffix="OMR off each item">
                  <input type="number" min="0" step="0.001" className="admin-input" value={f.discountAmount} onChange={(e) => set("discountAmount", e.target.value)} placeholder="2.000" />
                </Suffixed>
              </Field>
            )}
            {t === "FIXED_PRICE" && (
              <Field label="Sell each qualifying item for" name="fixedPrice" error={err("fixedPrice")} hint="Items already cheaper than this keep their own price.">
                <Suffixed suffix="OMR each">
                  <input type="number" min="0" step="0.001" className="admin-input" value={f.fixedPrice} onChange={(e) => set("fixedPrice", e.target.value)} placeholder="9.900" />
                </Suffixed>
              </Field>
            )}
            {isBxgy && (
              <>
                <div className="grid sm:grid-cols-2 gap-3">
                  <Field label="Customer buys" name="buyQuantity" error={err("buyQuantity")}>
                    <Suffixed suffix="item(s)">
                      <input type="number" min="1" step="1" className="admin-input" value={f.buyQuantity} onChange={(e) => set("buyQuantity", e.target.value)} />
                    </Suffixed>
                  </Field>
                  <Field label="And gets" name="getQuantity" error={err("getQuantity")}>
                    <Suffixed suffix="item(s)">
                      <input type="number" min="1" step="1" className="admin-input" value={f.getQuantity} onChange={(e) => set("getQuantity", e.target.value)} />
                    </Suffixed>
                  </Field>
                </div>
                <Field label="Reward" name="discountPercent" error={err("discountPercent")}>
                  <div className="flex flex-wrap items-center gap-2">
                    <Segmented
                      value={f.rewardMode}
                      onChange={(v) => set("rewardMode", v)}
                      options={[
                        ["free", "Free"],
                        ["percent", "% off"],
                      ]}
                    />
                    {f.rewardMode === "percent" && (
                      <Suffixed suffix="% off the reward items" className="w-56">
                        <input type="number" min="1" max="100" step="1" className="admin-input" value={f.discountPercent} onChange={(e) => set("discountPercent", e.target.value)} placeholder="50" />
                      </Suffixed>
                    )}
                  </div>
                </Field>
                <p className="text-xs text-slate-500 bg-slate-50 rounded-xl px-3 py-2">
                  Works in sets of {(intOrNull(f.buyQuantity) ?? 1) + (intOrNull(f.getQuantity) ?? 1)} items, most expensive first. The{" "}
                  {intOrNull(f.getQuantity) ?? 1} cheaper item(s) in each set are the reward. The customer needs the full set in the basket; the POS and checkout show a
                  “add 1 more” hint when they&apos;re close.
                </p>
              </>
            )}
            {t === "MIX_AND_MATCH" && (
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Any" name="buyQuantity" error={err("buyQuantity")}>
                  <Suffixed suffix="items">
                    <input type="number" min="2" step="1" className="admin-input" value={f.buyQuantity} onChange={(e) => set("buyQuantity", e.target.value)} placeholder="3" />
                  </Suffixed>
                </Field>
                <Field label="For" name="fixedPrice" error={err("fixedPrice")}>
                  <Suffixed suffix="OMR together">
                    <input type="number" min="0" step="0.001" className="admin-input" value={f.fixedPrice} onChange={(e) => set("fixedPrice", e.target.value)} placeholder="20.000" />
                  </Suffixed>
                </Field>
              </div>
            )}
            {t === "ORDER_THRESHOLD" && (
              <div className="space-y-3">
                <Field label="When customers spend at least" name="minSpend" error={err("minSpend")} hint="Counted on qualifying items, after other deals.">
                  <Suffixed suffix="OMR">
                    <input type="number" min="0" step="0.001" className="admin-input" value={f.minSpend} onChange={(e) => set("minSpend", e.target.value)} placeholder="50.000" />
                  </Suffixed>
                </Field>
                <Field label="They save" name={f.thresholdMode === "percent" ? "discountPercent" : "discountAmount"} error={err("discountPercent") || err("discountAmount")}>
                  <div className="flex flex-wrap items-center gap-2">
                    <Segmented
                      value={f.thresholdMode}
                      onChange={(v) => set("thresholdMode", v)}
                      options={[
                        ["percent", "%"],
                        ["amount", "OMR"],
                      ]}
                    />
                    {f.thresholdMode === "percent" ? (
                      <Suffixed suffix="% off qualifying items" className="w-60">
                        <input type="number" min="0" max="100" step="0.01" className="admin-input" value={f.discountPercent} onChange={(e) => set("discountPercent", e.target.value)} placeholder="10" />
                      </Suffixed>
                    ) : (
                      <Suffixed suffix="OMR off" className="w-48">
                        <input type="number" min="0" step="0.001" className="admin-input" value={f.discountAmount} onChange={(e) => set("discountAmount", e.target.value)} placeholder="5.000" />
                      </Suffixed>
                    )}
                  </div>
                </Field>
              </div>
            )}

            <div className="rounded-2xl bg-slate-900 text-white px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="text-lg font-semibold">{sentence.en}</span>
              <span className="text-base text-white/80" dir="rtl">
                {sentence.ar}
              </span>
            </div>
          </div>
        </Section>

        {/* 3 — Items */}
        <Section n={3} title={isBxgy ? "Qualifying items (buy)" : "Qualifying items"} desc="Which products the deal works on.">
          <div className="space-y-4">
            <Segmented
              value={f.buyScope}
              onChange={(v) => set("buyScope", v)}
              options={[
                ["PRODUCTS", "Specific products"],
                ["CATEGORIES", "Categories"],
                ["ALL", "Everything"],
              ]}
            />
            {f.buyScope === "PRODUCTS" && (
              <div data-field="buyProductIds">
                <SelectedProducts
                  products={f.buyProducts}
                  onOpen={() => setPicker("buy")}
                  onRemove={(id) => set("buyProducts", f.buyProducts.filter((p) => p.id !== id))}
                  onClear={() => set("buyProducts", [])}
                />
                {err("buyProductIds") && <ErrorText>{err("buyProductIds")}</ErrorText>}
              </div>
            )}
            {f.buyScope === "CATEGORIES" && (
              <div data-field="buyCategoryIds">
                <CategoryPicker categories={categories} selected={f.buyCategoryIds} onChange={(ids) => set("buyCategoryIds", ids)} disabled={!canManage} />
                <p className="text-xs text-slate-400 mt-1.5">Ticking a category includes all its sub-categories and future products added to them.</p>
                {err("buyCategoryIds") && <ErrorText>{err("buyCategoryIds")}</ErrorText>}
              </div>
            )}
            {f.buyScope === "ALL" && <p className="text-sm text-slate-500 bg-slate-50 rounded-xl px-3 py-2">Every product in the shop qualifies.</p>}

            <Toggle
              checked={f.excludeSaleItems}
              onChange={(v) => set("excludeSaleItems", v)}
              label="Skip items that are already on sale"
              hint="Products with a sale price won't get this deal on top."
            />
            {f.excludeSaleItems && f.buyScope === "PRODUCTS" && onSaleSelected > 0 && (
              <p className="text-xs text-amber-700 bg-amber-50 rounded-xl px-3 py-2 flex items-center gap-1.5">
                <LuCircleAlert size={14} /> {onSaleSelected} of the selected products are on sale and will be skipped.
              </p>
            )}

            {isBxgy && (
              <div className="border-t border-slate-100 pt-4 space-y-3">
                <div>
                  <p className="text-sm font-semibold text-slate-700">Reward items (get)</p>
                  <p className="text-xs text-slate-500">Usually the same items. Pick different ones for deals like “buy a dress, get a scarf free”.</p>
                </div>
                <Segmented
                  value={f.getScope}
                  onChange={(v) => set("getScope", v)}
                  options={[
                    ["SAME", "Same as above"],
                    ["PRODUCTS", "Specific products"],
                    ["CATEGORIES", "Categories"],
                    ["ALL", "Anything"],
                  ]}
                />
                {f.getScope === "PRODUCTS" && (
                  <div data-field="getProductIds">
                    <SelectedProducts
                      products={f.getProducts}
                      onOpen={() => setPicker("get")}
                      onRemove={(id) => set("getProducts", f.getProducts.filter((p) => p.id !== id))}
                      onClear={() => set("getProducts", [])}
                    />
                    {err("getProductIds") && <ErrorText>{err("getProductIds")}</ErrorText>}
                  </div>
                )}
                {f.getScope === "CATEGORIES" && (
                  <div data-field="getCategoryIds">
                    <CategoryPicker categories={categories} selected={f.getCategoryIds} onChange={(ids) => set("getCategoryIds", ids)} disabled={!canManage} />
                    {err("getCategoryIds") && <ErrorText>{err("getCategoryIds")}</ErrorText>}
                  </div>
                )}
              </div>
            )}
          </div>
        </Section>

        {/* 4 — Schedule */}
        <Section n={4} title="Schedule" desc="When it runs (shop time, Muscat). Leave the dates empty to run until you pause it.">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ["now", "Start now"],
                  ["today", "Today only"],
                  ["weekend", "This weekend"],
                  ["week", "Next 7 days"],
                  ["month", "Rest of this month"],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => {
                    const p = preset(k);
                    setF((prev) => ({ ...prev, startsAt: p.startsAt, ...(p.endsAt !== undefined && { endsAt: p.endsAt }) }));
                  }}
                  className="rounded-full bg-slate-100 hover:bg-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600"
                >
                  {label}
                </button>
              ))}
              {(f.startsAt || f.endsAt) && (
                <button type="button" onClick={() => setF((prev) => ({ ...prev, startsAt: "", endsAt: "" }))} className="rounded-full px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50">
                  Clear dates
                </button>
              )}
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Starts" name="startsAt" error={err("startsAt")} hint={f.startsAt ? undefined : "Empty = straight away"}>
                <input type="datetime-local" className="admin-input" value={f.startsAt} onChange={(e) => set("startsAt", e.target.value)} />
              </Field>
              <Field label="Ends" name="endsAt" error={err("endsAt")} hint={f.endsAt ? undefined : "Empty = no end date"}>
                <input type="datetime-local" className="admin-input" value={f.endsAt} onChange={(e) => set("endsAt", e.target.value)} />
              </Field>
            </div>

            <div data-field="daysOfWeek">
              <p className="text-sm font-medium text-slate-700 mb-1.5 flex items-center gap-1.5">
                <LuCalendar size={15} className="text-slate-400" /> Days of the week
              </p>
              <div className="flex flex-wrap items-center gap-1.5">
                {DAY_SHORT.map((d, i) => {
                  const on = f.daysOfWeek.includes(i);
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => set("daysOfWeek", on ? f.daysOfWeek.filter((x) => x !== i) : [...f.daysOfWeek, i].sort())}
                      className={`w-12 h-9 rounded-xl text-sm font-medium transition-colors ${on ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                    >
                      {d}
                    </button>
                  );
                })}
                <span className="mx-1 h-5 w-px bg-slate-200" />
                <button type="button" onClick={() => set("daysOfWeek", [])} className="text-xs text-slate-500 hover:text-slate-800 px-1.5">
                  Every day
                </button>
                <button type="button" onClick={() => set("daysOfWeek", [5, 6])} className="text-xs text-slate-500 hover:text-slate-800 px-1.5">
                  Weekend
                </button>
                <button type="button" onClick={() => set("daysOfWeek", [0, 1, 2, 3, 4])} className="text-xs text-slate-500 hover:text-slate-800 px-1.5">
                  Sun–Thu
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-1">{f.daysOfWeek.length === 0 || f.daysOfWeek.length === 7 ? "Runs every day." : "Only on the highlighted days."}</p>
            </div>

            <div className="space-y-2">
              <Toggle
                checked={f.timeWindow}
                onChange={(v) => set("timeWindow", v)}
                label="Only during certain hours (happy hour)"
                hint="e.g. 18:00–22:00. A window like 22:00–02:00 runs past midnight."
              />
              {f.timeWindow && (
                <div className="grid grid-cols-2 gap-3 max-w-sm">
                  <Field label="From" name="startTime" error={err("startTime")}>
                    <input type="time" className="admin-input" value={f.startTime} onChange={(e) => set("startTime", e.target.value)} />
                  </Field>
                  <Field label="Until" name="endTime" error={err("endTime")}>
                    <input type="time" className="admin-input" value={f.endTime} onChange={(e) => set("endTime", e.target.value)} />
                  </Field>
                </div>
              )}
            </div>
          </div>
        </Section>

        {/* 5 — Channel */}
        <Section n={5} title="Where it applies" desc="Online store, the in-store POS, or both.">
          <div className="grid sm:grid-cols-3 gap-3">
            {(
              [
                ["ALL", "Both", "Online + in store", LuMonitorSmartphone],
                ["ONLINE", "Online store", "Website checkout only", LuGlobe],
                ["POS", "In store", "POS till only", LuStore],
              ] as const
            ).map(([v, title, sub, Icon]) => {
              const on = f.channel === v;
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => set("channel", v)}
                  className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition-all ${on ? "border-indigo-500 ring-2 ring-indigo-100 bg-indigo-50/40" : "border-slate-200 hover:bg-slate-50"}`}
                >
                  <Icon size={20} className={on ? "text-indigo-600" : "text-slate-400"} />
                  <span>
                    <span className="block text-sm font-semibold text-slate-800">{title}</span>
                    <span className="block text-xs text-slate-500">{sub}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </Section>

        {/* 6 — Limits */}
        <Section n={6} title="Limits & priority" desc="Optional caps, and which deal wins when several match.">
          <div className="grid sm:grid-cols-3 gap-3">
            {t !== "ORDER_THRESHOLD" && (
              <Field label="Max times per order" name="maxApplicationsPerOrder" error={err("maxApplicationsPerOrder")} hint="Empty = no limit">
                <input type="number" min="1" step="1" className="admin-input" value={f.maxApplicationsPerOrder} onChange={(e) => set("maxApplicationsPerOrder", e.target.value)} placeholder="∞" />
              </Field>
            )}
            <Field
              label="Total orders allowed"
              name="usageLimit"
              error={err("usageLimit")}
              hint={initial ? `Used on ${initial.usedCount} order(s) so far` : "Empty = unlimited"}
            >
              <input type="number" min="1" step="1" className="admin-input" value={f.usageLimit} onChange={(e) => set("usageLimit", e.target.value)} placeholder="∞" />
            </Field>
            <Field label="Priority" name="priority" error={err("priority")} hint="Higher runs first">
              <input type="number" step="1" className="admin-input" value={f.priority} onChange={(e) => set("priority", e.target.value)} />
            </Field>
          </div>
          <div className="mt-4 rounded-xl bg-slate-50 p-3.5">
            <p className="text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1.5">
              <LuLayers size={14} /> How deals combine
            </p>
            <ul className="space-y-1 text-xs text-slate-500 list-disc pl-4">
              {COMBINE_RULES.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        </Section>

        {/* 7 — Naming */}
        <Section n={7} title="Name & wording" desc="Shown to staff, on receipts, and to shoppers.">
          <div className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Name (English)" name="nameEn" error={err("nameEn")}>
                <input className="admin-input" value={f.nameEn} onChange={(e) => set("nameEn", e.target.value)} placeholder="Weekend Buy 1 Get 2" />
              </Field>
              <Field label="Name (Arabic)" name="nameAr" error={err("nameAr")}>
                <input className="admin-input" dir="rtl" value={f.nameAr} onChange={(e) => set("nameAr", e.target.value)} placeholder="عرض نهاية الأسبوع" />
              </Field>
            </div>
            {(!f.nameEn || !f.nameAr) && (
              <button
                type="button"
                onClick={() => setF((prev) => ({ ...prev, nameEn: prev.nameEn || sentence.en, nameAr: prev.nameAr || sentence.ar }))}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800"
              >
                <LuWand size={13} /> Use “{sentence.en}” as the name
              </button>
            )}
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Badge (English)" name="badgeEn" error={err("badgeEn")} hint="Short label on product pages and receipts">
                <input
                  className="admin-input"
                  maxLength={40}
                  value={f.badgeEn}
                  onChange={(e) => setF((prev) => ({ ...prev, badgeEn: e.target.value, badgeAuto: false }))}
                />
              </Field>
              <Field label="Badge (Arabic)" name="badgeAr" error={err("badgeAr")}>
                <input
                  className="admin-input"
                  dir="rtl"
                  maxLength={40}
                  value={f.badgeAr}
                  onChange={(e) => setF((prev) => ({ ...prev, badgeAr: e.target.value, badgeAuto: false }))}
                />
              </Field>
            </div>
            {!f.badgeAuto && (
              <button type="button" onClick={() => set("badgeAuto", true)} className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800">
                <LuWand size={13} /> Write the badge from the rule
              </button>
            )}
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Description (English)" name="descriptionEn" error={err("descriptionEn")} hint="Optional: shown on the product page">
                <textarea rows={3} className="admin-input" value={f.descriptionEn} onChange={(e) => set("descriptionEn", e.target.value)} />
              </Field>
              <Field label="Description (Arabic)" name="descriptionAr" error={err("descriptionAr")}>
                <textarea rows={3} className="admin-input" dir="rtl" value={f.descriptionAr} onChange={(e) => set("descriptionAr", e.target.value)} />
              </Field>
            </div>
          </div>
        </Section>
      </fieldset>

      {/* Sidebar */}
      <aside className="space-y-4 lg:sticky lg:top-4">
        <div className="bg-white rounded-2xl border border-slate-200/70 p-4 space-y-3.5">
          <div className="flex items-center justify-between gap-2">
            <StatusChip status={status} />
            {canManage && (
              <label className="inline-flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                <span>{f.isActive ? "Switched on" : "Paused"}</span>
                <Switch checked={f.isActive} onChange={(v) => set("isActive", v)} />
              </label>
            )}
          </div>
          <div>
            <p className="font-semibold text-slate-800">{f.nameEn || "Untitled promotion"}</p>
            {f.nameAr && (
              <p className="text-sm text-slate-500" dir="rtl">
                {f.nameAr}
              </p>
            )}
          </div>
          {(f.badgeEn || f.badgeAr) && (
            <div className="flex flex-wrap gap-1.5">
              {f.badgeEn && <span className="rounded-md bg-rose-600 text-white px-2 py-0.5 text-xs font-semibold">{f.badgeEn}</span>}
              {f.badgeAr && (
                <span className="rounded-md bg-rose-600 text-white px-2 py-0.5 text-xs font-semibold" dir="rtl">
                  {f.badgeAr}
                </span>
              )}
            </div>
          )}
          <dl className="text-xs space-y-2 border-t border-slate-100 pt-3">
            <SummaryRow icon={LuTag} label="Deal" value={sentence.en} />
            <SummaryRow
              icon={LuLayers}
              label="Items"
              value={
                f.buyScope === "ALL"
                  ? "Everything"
                  : f.buyScope === "PRODUCTS"
                    ? `${f.buyProducts.length} product${f.buyProducts.length === 1 ? "" : "s"}`
                    : `${f.buyCategoryIds.length} categor${f.buyCategoryIds.length === 1 ? "y" : "ies"}`
              }
            />
            <SummaryRow
              icon={LuClock}
              label="When"
              value={formatSchedule({
                startsAtLocal: f.startsAt,
                endsAtLocal: f.endsAt,
                daysOfWeek: f.daysOfWeek,
                startTime: f.timeWindow ? f.startTime : null,
                endTime: f.timeWindow ? f.endTime : null,
              })}
            />
            <SummaryRow icon={LuStore} label="Where" value={CHANNEL_LABEL[f.channel]} />
          </dl>
          {showErrors && Object.keys(issues).length > 0 && (
            <p className="text-xs text-rose-600 bg-rose-50 rounded-lg px-3 py-2">
              {Object.keys(issues).length} thing(s) to fix: see the highlighted fields.
            </p>
          )}
          {canManage && (
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={save} disabled={saving} className="admin-btn admin-btn-primary flex-1 !py-2.5">
                {saving ? <LuLoaderCircle size={16} className="animate-spin" /> : <LuSave size={16} />}
                {initial ? "Save changes" : "Create promotion"}
              </button>
              {initial && initial.stats.redemptions === 0 && (
                <button type="button" onClick={() => setConfirmDelete(true)} className="admin-btn admin-btn-danger !px-3" title="Delete">
                  <LuTrash2 size={16} />
                </button>
              )}
            </div>
          )}
          {!canManage && (
            <p className="text-xs text-slate-500 flex items-center gap-1.5">
              <LuInfo size={14} /> You can view promotions but not change them.
            </p>
          )}
        </div>

        <PromotionSimulator
          rule={draftRule}
          ancestry={ancestry}
          suggestions={[...f.buyProducts, ...f.getProducts]}
        />
      </aside>

      <ProductPickerModal
        open={picker !== null}
        onClose={() => setPicker(null)}
        selected={picker === "get" ? f.getProducts : f.buyProducts}
        onChange={(list) => set(picker === "get" ? "getProducts" : "buyProducts", list)}
        categories={categories}
        title={picker === "get" ? "Reward products" : "Products on this promotion"}
      />

      <AdminModal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete this promotion?"
        footer={
          <>
            <button type="button" className="admin-btn admin-btn-secondary" onClick={() => setConfirmDelete(false)}>
              Keep it
            </button>
            <button type="button" className="admin-btn admin-btn-danger" onClick={remove}>
              <LuTrash2 size={15} /> Delete
            </button>
          </>
        }
      >
        <p className="text-sm text-slate-600">It has never been used, so nothing in your reports depends on it. This can&apos;t be undone.</p>
      </AdminModal>
    </div>
  );
}

// ───────── small building blocks ─────────

function Section({ n, title, desc, children }: { n: number; title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section className="admin-card p-4 sm:p-5">
      <div className="flex items-start gap-3 mb-4">
        <span className="w-7 h-7 rounded-full bg-slate-900 text-white text-xs font-bold flex items-center justify-center shrink-0">{n}</span>
        <div>
          <h2 className="font-semibold text-slate-800">{title}</h2>
          {desc && <p className="text-xs text-slate-500 mt-0.5">{desc}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function Field({ label, name, error, hint, children }: { label: string; name: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div data-field={name}>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <div className={error ? "[&_.admin-input]:!border-rose-300" : ""}>{children}</div>
      {error ? <ErrorText>{error}</ErrorText> : hint ? <p className="text-xs text-slate-400 mt-1">{hint}</p> : null}
    </div>
  );
}

function ErrorText({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs text-rose-600 mt-1 flex items-center gap-1 admin-fade-in">
      <LuCircleAlert size={13} /> {children}
    </p>
  );
}

function Suffixed({ suffix, children, className = "" }: { suffix: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="w-32 shrink-0">{children}</div>
      <span className="text-sm text-slate-500">{suffix}</span>
    </div>
  );
}

function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: readonly (readonly [T, string])[] }) {
  return (
    <div className="inline-flex flex-wrap rounded-xl bg-slate-100 p-1 gap-1">
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${value === v ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function Switch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative w-10 h-6 rounded-full transition-colors ${checked ? "bg-emerald-500" : "bg-slate-300"}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-4" : ""}`} />
    </button>
  );
}

function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <span className="pt-0.5">
        <Switch checked={checked} onChange={onChange} />
      </span>
      <span>
        <span className="block text-sm font-medium text-slate-700">{label}</span>
        {hint && <span className="block text-xs text-slate-500">{hint}</span>}
      </span>
    </label>
  );
}

function SummaryRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <Icon size={14} className="text-slate-400 mt-px shrink-0" />
      <dt className="text-slate-400 w-12 shrink-0">{label}</dt>
      <dd className="text-slate-700 min-w-0">{value}</dd>
    </div>
  );
}

function SelectedProducts({
  products,
  onOpen,
  onRemove,
  onClear,
}: {
  products: PickerProduct[];
  onOpen: () => void;
  onRemove: (id: string) => void;
  onClear: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? products : products.slice(0, 12);
  const onSale = products.filter((p) => p.onSale).length;
  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={onOpen} className="admin-btn admin-btn-secondary">
          <LuPlus size={15} /> {products.length ? "Add / change products" : "Choose products"}
        </button>
        {products.length > 0 && (
          <>
            <span className="text-sm text-slate-500">
              {products.length} selected{onSale > 0 && ` · ${onSale} on sale`}
            </span>
            <button type="button" onClick={onClear} className="text-xs text-rose-600 hover:underline ml-auto">
              Remove all
            </button>
          </>
        )}
      </div>
      {products.length > 0 && (
        <div className="grid sm:grid-cols-2 gap-2">
          {shown.map((p) => (
            <div key={p.id} className="flex items-center gap-2.5 rounded-xl border border-slate-200 p-2 admin-fade-in">
              <span className="w-9 h-11 rounded-lg bg-slate-100 overflow-hidden shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {p.imageUrl && <img src={p.imageUrl} alt="" className="w-full h-full object-cover" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm text-slate-800 truncate">{p.nameEn}</span>
                <span className="block text-xs text-slate-500 tabular-nums">
                  {p.price.toFixed(3)}
                  {p.onSale && (
                    <>
                      <span className="line-through text-slate-400 ml-1.5">{p.basePrice.toFixed(3)}</span>
                      <span className="ml-1.5 rounded bg-rose-50 text-rose-600 px-1 text-[10px] font-semibold">SALE</span>
                    </>
                  )}
                </span>
              </span>
              <button type="button" onClick={() => onRemove(p.id)} className="p-1 text-slate-300 hover:text-rose-500" aria-label={`Remove ${p.nameEn}`}>
                <LuX size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
      {products.length > 12 && (
        <button type="button" onClick={() => setExpanded((v) => !v)} className="text-xs font-medium text-indigo-600 hover:text-indigo-800">
          {expanded ? "Show fewer" : `Show all ${products.length}`}
        </button>
      )}
    </div>
  );
}
