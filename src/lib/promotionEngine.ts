// Pure promotion engine — shared by the server (source of truth when an order
// is written) and the POS / checkout (live preview), so both always agree.
//
// How deals combine:
//  • Item-level deals (% off, amount off, fixed price, buy X get Y, mix &
//    match) run in priority order (highest first). Each unit in the cart can
//    be used by ONE item-level deal — whichever claims it first.
//  • Then at most one "spend X, save Y" (ORDER_THRESHOLD) deal applies — the
//    one that saves the customer most — on top of item-level deals.
//  • Buy-X-get-Y and mix & match work on the most expensive qualifying units
//    first; for buy X get Y the cheaper units in each set are the reward.

import { allocate, r3 } from "@/lib/taxCalc";

export type PromotionTypeKey =
  | "PERCENT_OFF"
  | "AMOUNT_OFF"
  | "FIXED_PRICE"
  | "BUY_X_GET_Y"
  | "MIX_AND_MATCH"
  | "ORDER_THRESHOLD";
export type PromotionScopeKey = "ALL" | "PRODUCTS" | "CATEGORIES";
export type PromotionChannelKey = "ALL" | "ONLINE" | "POS";

export const PROMOTION_TYPES: PromotionTypeKey[] = [
  "BUY_X_GET_Y",
  "MIX_AND_MATCH",
  "PERCENT_OFF",
  "AMOUNT_OFF",
  "FIXED_PRICE",
  "ORDER_THRESHOLD",
];

export const PROMOTION_TYPE_LABEL: Record<PromotionTypeKey, { en: string; ar: string; hint: string }> = {
  BUY_X_GET_Y: { en: "Buy X, get Y", ar: "اشترِ واحصل", hint: "e.g. buy 1 get 2 free, or buy 2 get 1 at 50% off" },
  MIX_AND_MATCH: { en: "Mix & match", ar: "اختر ما تشاء", hint: "any N items from the selection for a set price" },
  PERCENT_OFF: { en: "Percentage off", ar: "خصم بالنسبة", hint: "X% off every qualifying item" },
  AMOUNT_OFF: { en: "Amount off", ar: "خصم بمبلغ", hint: "X OMR off every qualifying item" },
  FIXED_PRICE: { en: "Fixed price", ar: "سعر ثابت", hint: "qualifying items sell at a set price" },
  ORDER_THRESHOLD: { en: "Spend & save", ar: "أنفق ووفّر", hint: "spend X on qualifying items, save Y" },
};

export type PromotionRule = {
  id: string;
  nameEn: string;
  nameAr: string;
  badgeEn: string | null;
  badgeAr: string | null;
  /** Optional shopper-facing wording (product page). */
  descriptionEn?: string | null;
  descriptionAr?: string | null;
  type: PromotionTypeKey;
  channel: PromotionChannelKey;
  isActive: boolean;
  /** ISO timestamps. */
  startsAt: string | null;
  endsAt: string | null;
  /** 0 = Sunday … 6 = Saturday; null/empty = every day. */
  daysOfWeek: number[] | null;
  /** "HH:MM" shop time. */
  startTime: string | null;
  endTime: string | null;
  priority: number;
  discountPercent: number | null;
  discountAmount: number | null;
  fixedPrice: number | null;
  buyQuantity: number | null;
  getQuantity: number | null;
  minSpend: number | null;
  maxApplicationsPerOrder: number | null;
  usageLimit: number | null;
  usedCount: number;
  buyScope: PromotionScopeKey;
  getScope: PromotionScopeKey | null;
  excludeSaleItems: boolean;
  buyProductIds: string[];
  buyCategoryIds: string[];
  getProductIds: string[];
  getCategoryIds: string[];
};

export type PromoLineInput = {
  productId: string;
  /** The product's category and all its ancestors. */
  categoryIds: string[];
  unitPrice: number;
  quantity: number;
  /** Already has a sale price (for "exclude sale items"). */
  onSale: boolean;
};

export type AppliedPromotion = {
  id: string;
  nameEn: string;
  nameAr: string;
  badgeEn: string | null;
  badgeAr: string | null;
  type: PromotionTypeKey;
  discount: number;
  units: number;
  applications: number;
};

export type PromoHint = { promotionId: string; messageEn: string; messageAr: string };

export type PromoResult = {
  /** Promotion discount per input line. */
  lineDiscounts: number[];
  applied: AppliedPromotion[];
  total: number;
  /** "Add 1 more to get 2 free" style nudges for the cashier / shopper. */
  hints: PromoHint[];
};

// Oman is UTC+4 all year (no DST).
const SHOP_OFFSET_MS = 4 * 3600 * 1000;

function shopClock(now: Date) {
  const local = new Date(now.getTime() + SHOP_OFFSET_MS);
  return { weekday: local.getUTCDay(), minutes: local.getUTCHours() * 60 + local.getUTCMinutes() };
}

const toMinutes = (hhmm: string | null) => {
  if (!hhmm || !/^\d{1,2}:\d{2}$/.test(hhmm)) return null;
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

/** Whether a promotion is running right now on this channel. */
export function isPromotionLive(p: PromotionRule, channel: "ONLINE" | "POS", now: Date = new Date()): boolean {
  if (!p.isActive) return false;
  if (p.channel !== "ALL" && p.channel !== channel) return false;
  if (p.startsAt && new Date(p.startsAt) > now) return false;
  if (p.endsAt && new Date(p.endsAt) < now) return false;
  if (p.usageLimit != null && p.usedCount >= p.usageLimit) return false;
  const { weekday, minutes } = shopClock(now);
  if (p.daysOfWeek && p.daysOfWeek.length > 0 && !p.daysOfWeek.includes(weekday)) return false;
  const start = toMinutes(p.startTime);
  const end = toMinutes(p.endTime);
  if (start != null && end != null && start !== end) {
    // A window like 22:00–02:00 wraps past midnight.
    const inWindow = start < end ? minutes >= start && minutes < end : minutes >= start || minutes < end;
    if (!inWindow) return false;
  }
  return true;
}

export type PromotionStatus = "ACTIVE" | "SCHEDULED" | "EXPIRED" | "PAUSED" | "USED_UP";

/** Lifecycle status for the admin list (ignores day/time windows). */
export function promotionStatus(p: Pick<PromotionRule, "isActive" | "startsAt" | "endsAt" | "usageLimit" | "usedCount">, now = new Date()): PromotionStatus {
  if (!p.isActive) return "PAUSED";
  if (p.endsAt && new Date(p.endsAt) < now) return "EXPIRED";
  if (p.usageLimit != null && p.usedCount >= p.usageLimit) return "USED_UP";
  if (p.startsAt && new Date(p.startsAt) > now) return "SCHEDULED";
  return "ACTIVE";
}

function inScope(scope: PromotionScopeKey, productIds: string[], categoryIds: string[], line: PromoLineInput) {
  if (scope === "ALL") return true;
  if (scope === "PRODUCTS") return productIds.includes(line.productId);
  return line.categoryIds.some((c) => categoryIds.includes(c));
}

/** Whether a product qualifies for a promotion's buy side (for badges on product pages). */
export function productQualifies(p: PromotionRule, line: Pick<PromoLineInput, "productId" | "categoryIds" | "onSale">): boolean {
  if (p.excludeSaleItems && line.onSale) return false;
  const l = { ...line, unitPrice: 0, quantity: 0 };
  if (inScope(p.buyScope, p.buyProductIds, p.buyCategoryIds, l)) return true;
  return p.type === "BUY_X_GET_Y" && p.getScope != null && inScope(p.getScope, p.getProductIds, p.getCategoryIds, l);
}

type Unit = { line: number; price: number; discount: number; used: boolean };

const fmt = (n: number) => n.toFixed(3);

/** Plain-English summary of a rule, e.g. "Buy 1, get 2 free". */
export function describePromotion(p: Pick<PromotionRule, "type" | "discountPercent" | "discountAmount" | "fixedPrice" | "buyQuantity" | "getQuantity" | "minSpend">): { en: string; ar: string } {
  const pct = p.discountPercent ?? 0;
  switch (p.type) {
    case "PERCENT_OFF":
      return { en: `${pct}% off`, ar: `خصم ${pct}%` };
    case "AMOUNT_OFF":
      return { en: `${fmt(p.discountAmount ?? 0)} OMR off each`, ar: `خصم ${fmt(p.discountAmount ?? 0)} ر.ع. لكل قطعة` };
    case "FIXED_PRICE":
      return { en: `Now ${fmt(p.fixedPrice ?? 0)} OMR each`, ar: `الآن ${fmt(p.fixedPrice ?? 0)} ر.ع. للقطعة` };
    case "BUY_X_GET_Y": {
      const x = p.buyQuantity ?? 1;
      const y = p.getQuantity ?? 1;
      const reward = pct >= 100 || !p.discountPercent ? "free" : `${pct}% off`;
      const rewardAr = pct >= 100 || !p.discountPercent ? "مجاناً" : `بخصم ${pct}%`;
      return { en: `Buy ${x}, get ${y} ${reward}`, ar: `اشترِ ${x} واحصل على ${y} ${rewardAr}` };
    }
    case "MIX_AND_MATCH":
      return { en: `Any ${p.buyQuantity ?? 2} for ${fmt(p.fixedPrice ?? 0)} OMR`, ar: `أي ${p.buyQuantity ?? 2} بـ ${fmt(p.fixedPrice ?? 0)} ر.ع.` };
    case "ORDER_THRESHOLD": {
      const save = p.discountPercent ? `${p.discountPercent}%` : `${fmt(p.discountAmount ?? 0)} OMR`;
      const saveAr = p.discountPercent ? `${p.discountPercent}%` : `${fmt(p.discountAmount ?? 0)} ر.ع.`;
      return { en: `Spend ${fmt(p.minSpend ?? 0)} OMR, save ${save}`, ar: `أنفق ${fmt(p.minSpend ?? 0)} ر.ع. ووفّر ${saveAr}` };
    }
  }
}

/**
 * Applies the live promotions to a cart. `rules` may contain anything — only
 * the ones running now on `channel` are used.
 */
export function applyPromotions(
  lines: PromoLineInput[],
  rules: PromotionRule[],
  channel: "ONLINE" | "POS",
  now: Date = new Date(),
): PromoResult {
  const units: Unit[] = [];
  lines.forEach((l, i) => {
    const qty = Math.max(0, Math.floor(l.quantity));
    for (let q = 0; q < qty; q++) units.push({ line: i, price: r3(Math.max(0, l.unitPrice)), discount: 0, used: false });
  });

  const live = rules.filter((p) => isPromotionLive(p, channel, now));
  const itemRules = live
    .filter((p) => p.type !== "ORDER_THRESHOLD")
    .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
  const applied = new Map<string, AppliedPromotion>();
  const hints: PromoHint[] = [];

  const record = (p: PromotionRule, discount: number, unitCount: number, applications: number) => {
    if (discount <= 0) return;
    const a = applied.get(p.id) ?? {
      id: p.id,
      nameEn: p.nameEn,
      nameAr: p.nameAr,
      badgeEn: p.badgeEn,
      badgeAr: p.badgeAr,
      type: p.type,
      discount: 0,
      units: 0,
      applications: 0,
    };
    a.discount = r3(a.discount + discount);
    a.units += unitCount;
    a.applications += applications;
    applied.set(p.id, a);
  };

  const buyOk = (p: PromotionRule) => (u: Unit) => {
    const l = lines[u.line];
    if (p.excludeSaleItems && l.onSale) return false;
    return inScope(p.buyScope, p.buyProductIds, p.buyCategoryIds, l);
  };
  const getOk = (p: PromotionRule) => (u: Unit) => {
    const l = lines[u.line];
    if (p.excludeSaleItems && l.onSale) return false;
    if (p.getScope == null) return inScope(p.buyScope, p.buyProductIds, p.buyCategoryIds, l);
    return inScope(p.getScope, p.getProductIds, p.getCategoryIds, l);
  };
  const byPriceDesc = (a: Unit, b: Unit) => b.price - a.price || a.line - b.line;
  const cap = (p: PromotionRule, n: number) => (p.maxApplicationsPerOrder && p.maxApplicationsPerOrder > 0 ? Math.min(n, p.maxApplicationsPerOrder) : n);

  for (const p of itemRules) {
    const free = units.filter((u) => !u.used && u.price > 0);
    switch (p.type) {
      case "PERCENT_OFF":
      case "AMOUNT_OFF":
      case "FIXED_PRICE": {
        const eligible = free.filter(buyOk(p)).sort(byPriceDesc);
        let total = 0;
        let count = 0;
        for (const u of eligible) {
          if (count >= cap(p, Infinity)) break;
          let d = 0;
          if (p.type === "PERCENT_OFF") d = r3((u.price * Math.min(100, Math.max(0, p.discountPercent ?? 0))) / 100);
          else if (p.type === "AMOUNT_OFF") d = r3(Math.min(u.price, Math.max(0, p.discountAmount ?? 0)));
          else d = p.fixedPrice != null && u.price > p.fixedPrice ? r3(u.price - Math.max(0, p.fixedPrice)) : 0;
          if (d <= 0) continue;
          u.used = true;
          u.discount = r3(u.discount + d);
          total += d;
          count++;
        }
        record(p, r3(total), count, count);
        break;
      }
      case "BUY_X_GET_Y": {
        const x = Math.max(1, p.buyQuantity ?? 1);
        const y = Math.max(1, p.getQuantity ?? 1);
        const pct = Math.min(100, Math.max(0, p.discountPercent ?? 100));
        let total = 0;
        let apps = 0;
        let rewarded = 0;
        if (p.getScope == null) {
          // Same items on both sides: in each set of X+Y (priciest first),
          // the Y cheapest of the set are the reward.
          const eligible = free.filter(buyOk(p)).sort(byPriceDesc);
          const sets = cap(p, Math.floor(eligible.length / (x + y)));
          for (let s = 0; s < sets; s++) {
            const set = eligible.slice(s * (x + y), (s + 1) * (x + y));
            set.forEach((u) => (u.used = true));
            for (const u of set.slice(x)) {
              const d = r3((u.price * pct) / 100);
              u.discount = r3(u.discount + d);
              total += d;
              rewarded++;
            }
            apps++;
          }
          const rest = eligible.length - sets * (x + y);
          if (rest >= x && (!p.maxApplicationsPerOrder || sets < p.maxApplicationsPerOrder)) {
            const need = x + y - rest;
            hints.push({
              promotionId: p.id,
              messageEn: `${p.nameEn}: add ${need} more qualifying item${need === 1 ? "" : "s"} to get ${y} ${pct >= 100 ? "free" : `at ${pct}% off`}.`,
              messageAr: `${p.nameAr}: أضف ${need} قطعة مؤهلة للحصول على ${y} ${pct >= 100 ? "مجاناً" : `بخصم ${pct}%`}.`,
            });
          }
        } else {
          // Different reward items: X priciest qualifying units buy Y of the
          // cheapest reward units, repeatedly.
          while (!p.maxApplicationsPerOrder || apps < p.maxApplicationsPerOrder) {
            const buyers = units.filter((u) => !u.used && u.price > 0).filter(buyOk(p)).sort(byPriceDesc).slice(0, x);
            if (buyers.length < x) break;
            const rewards = units
              .filter((u) => !u.used && u.price > 0 && !buyers.includes(u))
              .filter(getOk(p))
              .sort((a, b) => a.price - b.price || a.line - b.line)
              .slice(0, y);
            if (rewards.length < y) {
              hints.push({
                promotionId: p.id,
                messageEn: `${p.nameEn}: add ${y - rewards.length} reward item${y - rewards.length === 1 ? "" : "s"} to the cart to get ${pct >= 100 ? "them free" : `${pct}% off`}.`,
                messageAr: `${p.nameAr}: أضف ${y - rewards.length} من المنتجات المشمولة بالعرض للاستفادة منه.`,
              });
              break;
            }
            buyers.forEach((u) => (u.used = true));
            for (const u of rewards) {
              u.used = true;
              const d = r3((u.price * pct) / 100);
              u.discount = r3(u.discount + d);
              total += d;
              rewarded++;
            }
            apps++;
          }
        }
        record(p, r3(total), rewarded, apps);
        break;
      }
      case "MIX_AND_MATCH": {
        const n = Math.max(2, p.buyQuantity ?? 2);
        const price = Math.max(0, p.fixedPrice ?? 0);
        const eligible = free.filter(buyOk(p)).sort(byPriceDesc);
        const sets = cap(p, Math.floor(eligible.length / n));
        let total = 0;
        let apps = 0;
        let count = 0;
        for (let s = 0; s < sets; s++) {
          const set = eligible.slice(s * n, (s + 1) * n);
          const sum = r3(set.reduce((t, u) => t + u.price, 0));
          if (sum <= price) continue;
          const shares = allocate(r3(sum - price), set.map((u) => u.price));
          set.forEach((u, i) => {
            u.used = true;
            u.discount = r3(u.discount + shares[i]);
          });
          total += sum - price;
          apps++;
          count += n;
        }
        const rest = eligible.length - sets * n;
        if (rest > 0 && (!p.maxApplicationsPerOrder || sets < p.maxApplicationsPerOrder)) {
          hints.push({
            promotionId: p.id,
            messageEn: `${p.nameEn}: add ${n - rest} more to get ${n} for ${fmt(price)} OMR.`,
            messageAr: `${p.nameAr}: أضف ${n - rest} للحصول على ${n} بـ ${fmt(price)} ر.ع.`,
          });
        }
        record(p, r3(total), count, apps);
        break;
      }
    }
  }

  // Spend & save — the single best qualifying deal, on top of item deals.
  let best: { p: PromotionRule; discount: number; units: Unit[] } | null = null;
  for (const p of live.filter((r) => r.type === "ORDER_THRESHOLD")) {
    const eligible = units.filter((u) => u.price - u.discount > 0).filter(buyOk(p));
    const spend = r3(eligible.reduce((t, u) => t + (u.price - u.discount), 0));
    const min = Math.max(0, p.minSpend ?? 0);
    if (spend <= 0) continue;
    if (spend + 0.0005 < min) {
      if (spend >= min * 0.5) {
        hints.push({
          promotionId: p.id,
          messageEn: `${p.nameEn}: spend ${fmt(min - spend)} OMR more to unlock it.`,
          messageAr: `${p.nameAr}: أنفق ${fmt(min - spend)} ر.ع. إضافية للاستفادة من العرض.`,
        });
      }
      continue;
    }
    const discount = p.discountPercent
      ? r3((spend * Math.min(100, p.discountPercent)) / 100)
      : r3(Math.min(spend, Math.max(0, p.discountAmount ?? 0)));
    if (discount > 0 && (!best || discount > best.discount)) best = { p, discount, units: eligible };
  }
  if (best) {
    const shares = allocate(best.discount, best.units.map((u) => r3(u.price - u.discount)));
    best.units.forEach((u, i) => (u.discount = r3(u.discount + shares[i])));
    record(best.p, best.discount, best.units.length, 1);
  }

  const lineDiscounts = lines.map(() => 0);
  for (const u of units) lineDiscounts[u.line] = r3(lineDiscounts[u.line] + u.discount);
  // Never discount a line below zero.
  lines.forEach((l, i) => {
    const max = r3(Math.max(0, l.unitPrice) * Math.max(0, l.quantity));
    if (lineDiscounts[i] > max) lineDiscounts[i] = max;
  });

  const appliedList = Array.from(applied.values());
  return {
    lineDiscounts,
    applied: appliedList,
    total: r3(lineDiscounts.reduce((s, d) => s + d, 0)),
    hints,
  };
}
