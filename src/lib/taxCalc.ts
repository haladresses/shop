// Pure VAT arithmetic shared by the server (order creation, POS checkout,
// quotes, reports) and the browser (POS cart, checkout summary), so what the
// cashier/shopper sees is exactly what gets charged. No database access here.

export type TaxKind = "STANDARD" | "ZERO_RATED" | "EXEMPT" | "OUT_OF_SCOPE";

export const TAX_KINDS: TaxKind[] = ["STANDARD", "ZERO_RATED", "EXEMPT", "OUT_OF_SCOPE"];

export const TAX_KIND_LABEL: Record<TaxKind, { en: string; ar: string; hint: string }> = {
  STANDARD: { en: "Standard rated", ar: "خاضع بالنسبة الأساسية", hint: "VAT charged at the rate." },
  ZERO_RATED: { en: "Zero rated", ar: "خاضع بنسبة صفر", hint: "Taxable at 0% — still reported on the VAT return." },
  EXEMPT: { en: "Exempt", ar: "معفى", hint: "No VAT and not a taxable supply." },
  OUT_OF_SCOPE: { en: "Out of scope", ar: "خارج النطاق", hint: "Outside the VAT system." },
};

/** Store-wide VAT configuration (Admin → Tax & VAT). */
export type TaxSettings = {
  /** Master switch. Off = no VAT anywhere (invoices, POS, checkout). */
  enabled: boolean;
  /** Shelf prices already include VAT (usual for retail in Oman). */
  pricesIncludeTax: boolean;
  /** The store's VAT registration number (VATIN), printed on every invoice. */
  vatNumber: string;
  /** Legal (registered) name for tax invoices, if different from the store name. */
  legalNameEn: string;
  legalNameAr: string;
  /** Commercial registration number, printed on invoices. */
  crNumber: string;
  /** Charge VAT on delivery fees at the default rate. */
  taxShipping: boolean;
  /** Show "incl. VAT" notes and the VAT line on the storefront. */
  showOnStorefront: boolean;
  /** Extra text at the bottom of every printed bill (returns policy …). */
  invoiceFooterEn: string;
  invoiceFooterAr: string;
};

export const DEFAULT_TAX_SETTINGS: TaxSettings = {
  enabled: false,
  pricesIncludeTax: true,
  vatNumber: "",
  legalNameEn: "",
  legalNameAr: "",
  crNumber: "",
  taxShipping: true,
  showOnStorefront: true,
  invoiceFooterEn: "",
  invoiceFooterAr: "",
};

/** A resolved VAT rate as applied to one line. */
export type RateInfo = {
  id: string | null;
  code: string;
  nameEn: string;
  nameAr: string;
  /** Percentage, e.g. 5 for 5%. */
  rate: number;
  type: TaxKind;
};

export const NO_TAX: RateInfo = {
  id: null,
  code: "",
  nameEn: "No VAT",
  nameAr: "بدون ضريبة",
  rate: 0,
  type: "OUT_OF_SCOPE",
};

export const r3 = (n: number) => Math.round((n + Number.EPSILON) * 1000) / 1000;

export type TaxLineInput = {
  /** quantity × unit price, in the store's price basis (incl. or excl. VAT). */
  amount: number;
  tax: RateInfo;
};

export type TaxLineResult = {
  /** This line's share of the order discount (price basis). */
  discount: number;
  /** Amount VAT is charged on (excl. VAT, after discount). */
  taxable: number;
  tax: number;
  /** taxable + tax — what the customer pays for the line. */
  gross: number;
};

export type TaxBreakdownRow = {
  code: string;
  nameEn: string;
  nameAr: string;
  rate: number;
  type: TaxKind;
  taxable: number;
  tax: number;
};

export type SaleTaxResult = {
  lines: TaxLineResult[];
  /** Σ line amounts (price basis), before discount. */
  subtotal: number;
  discount: number;
  /** Shipping as charged (price basis). */
  shipping: number;
  shippingTaxable: number;
  shippingTax: number;
  /** Σ taxable amounts incl. shipping. */
  taxableTotal: number;
  taxTotal: number;
  /** What the customer pays. */
  total: number;
  breakdown: TaxBreakdownRow[];
  pricesIncludeTax: boolean;
  enabled: boolean;
};

/** Spreads `amount` over `weights` proportionally; the last weighted slot takes the rounding remainder. */
export function allocate(amount: number, weights: number[]): number[] {
  const sum = weights.reduce((s, w) => s + w, 0);
  if (amount <= 0 || sum <= 0) return weights.map(() => 0);
  let lastIdx = -1;
  weights.forEach((w, i) => {
    if (w > 0) lastIdx = i;
  });
  let used = 0;
  return weights.map((w, i) => {
    if (w <= 0) return 0;
    if (i === lastIdx) return r3(amount - used);
    const share = r3((amount * w) / sum);
    used += share;
    return share;
  });
}

/** Splits an amount in the price basis into its taxable part and VAT. */
export function splitTax(amount: number, rate: number, inclusive: boolean): { taxable: number; tax: number } {
  if (rate <= 0) return { taxable: r3(amount), tax: 0 };
  if (inclusive) {
    const tax = r3((amount * rate) / (100 + rate));
    return { taxable: r3(amount - tax), tax };
  }
  return { taxable: r3(amount), tax: r3((amount * rate) / 100) };
}

/**
 * VAT for a sale. The order discount is spread over the lines in proportion
 * to their value (VAT is charged on the discounted amount), shipping is taxed
 * at `shippingTax` when given, and the result carries a per-rate breakdown
 * for the invoice. With VAT disabled every tax figure is zero and the total
 * is exactly subtotal − discount + shipping.
 */
export function calculateSaleTax(input: {
  lines: TaxLineInput[];
  discount?: number;
  shipping?: number;
  shippingTax?: RateInfo | null;
  settings: Pick<TaxSettings, "enabled" | "pricesIncludeTax">;
}): SaleTaxResult {
  const enabled = !!input.settings.enabled;
  const inclusive = enabled ? !!input.settings.pricesIncludeTax : true;
  const amounts = input.lines.map((l) => r3(Math.max(0, l.amount)));
  const subtotal = r3(amounts.reduce((s, a) => s + a, 0));
  const discount = r3(Math.min(Math.max(input.discount ?? 0, 0), subtotal));
  const shipping = r3(Math.max(0, input.shipping ?? 0));
  const shares = allocate(discount, amounts);

  const groups = new Map<string, TaxBreakdownRow>();
  const addToGroup = (t: RateInfo, taxable: number, tax: number) => {
    if (!enabled) return;
    const key = `${t.code}|${t.rate}`;
    const g = groups.get(key) ?? { code: t.code, nameEn: t.nameEn, nameAr: t.nameAr, rate: t.rate, type: t.type, taxable: 0, tax: 0 };
    g.taxable = r3(g.taxable + taxable);
    g.tax = r3(g.tax + tax);
    groups.set(key, g);
  };

  const lines: TaxLineResult[] = input.lines.map((l, i) => {
    const base = r3(amounts[i] - shares[i]);
    const rate = enabled ? l.tax.rate : 0;
    const { taxable, tax } = splitTax(base, rate, inclusive);
    addToGroup(l.tax, taxable, tax);
    return { discount: shares[i], taxable, tax, gross: r3(taxable + tax) };
  });

  const shipRate = enabled && input.shippingTax ? input.shippingTax.rate : 0;
  const ship = splitTax(shipping, shipRate, inclusive);
  if (shipping > 0 && enabled && input.shippingTax) addToGroup(input.shippingTax, ship.taxable, ship.tax);

  const linesTax = lines.reduce((s, l) => s + l.tax, 0);
  const taxTotal = r3(linesTax + ship.tax);
  const taxableTotal = r3(lines.reduce((s, l) => s + l.taxable, 0) + ship.taxable);
  const total = inclusive ? r3(subtotal - discount + shipping) : r3(subtotal - discount + shipping + taxTotal);

  return {
    lines,
    subtotal,
    discount,
    shipping,
    shippingTaxable: ship.taxable,
    shippingTax: ship.tax,
    taxableTotal,
    taxTotal,
    total,
    breakdown: Array.from(groups.values()).sort((a, b) => b.rate - a.rate),
    pricesIncludeTax: inclusive,
    enabled,
  };
}

/** "5%" / "0%" / "Exempt" style short label. */
export function rateLabel(t: Pick<RateInfo, "rate" | "type">, lang: "en" | "ar" = "en"): string {
  if (t.type === "EXEMPT") return lang === "ar" ? "معفى" : "Exempt";
  if (t.type === "OUT_OF_SCOPE") return lang === "ar" ? "خارج النطاق" : "Out of scope";
  const pct = Number.isInteger(t.rate) ? String(t.rate) : t.rate.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  return `${pct}%`;
}

/** Oman VATIN format: "OM" + 10 digits. Empty is allowed (not registered yet). */
export function isValidOmanVatNumber(v: string): boolean {
  return v === "" || /^OM\d{10}$/i.test(v.replace(/\s+/g, ""));
}
