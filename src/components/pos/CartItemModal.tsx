"use client";
import { useEffect, useMemo, useState } from "react";
import { LuChevronLeft, LuChevronRight, LuLoaderCircle, LuMinus, LuPlus, LuRefreshCw, LuShoppingBag, LuTag, LuTrash2 } from "react-icons/lu";
import { PosModal, omr } from "@/components/pos/PosUi";
import BarcodePreview from "@/components/admin/BarcodePreview";
import { formatVariantLabel } from "@/lib/utils";
import { rateLabel, type RateInfo } from "@/lib/taxCalc";

// Big "review this item" view for a line in the POS sale: photos, every
// detail, the price breakdown for this line, and quick changes (quantity,
// switch size / colour, remove).

export type PosCartLine = {
  productId: string;
  variantId: string | null;
  nameEn: string;
  nameAr: string;
  color: string | null;
  colorParts: { part: string; color: string }[] | null;
  size: string | null;
  sku: string | null;
  barcode: string | null;
  unitPrice: number;
  stock: number | null;
  imageUrl: string | null;
  tax?: RateInfo;
  categoryIds?: string[];
  onSale?: boolean;
  quantity: number;
};

type ProductDetail = {
  id: string;
  nameEn: string;
  nameAr: string;
  descriptionEn?: string | null;
  descriptionAr?: string | null;
  sku?: string | null;
  barcode?: string | null;
  basePrice: number | string;
  salePrice: number | string | null;
  category?: { nameEn: string; nameAr?: string } | null;
  images: { url: string; color?: string | null; isPrimary?: boolean }[];
  variants: {
    id: string;
    color: string | null;
    colorHex: string | null;
    colorParts: { part: string; color: string; colorHex?: string | null }[] | null;
    size: string | null;
    sku: string | null;
    barcode: string | null;
    priceAdjustment: number | string;
    isActive: boolean;
    inventory?: { quantity: number } | null;
  }[];
};

const r3 = (n: number) => Math.round(n * 1000) / 1000;
const keyOf = (l: { variantId: string | null; productId: string }) => l.variantId || l.productId;
/** Short "Colour / Size" name for an option chip (the full colour breakdown is shown separately). */
const shortLabel = (o: { color: string | null; size: string | null }) => [o.color, o.size].filter(Boolean).join(" / ") || "Standard";

export default function CartItemModal({
  line,
  saleLine,
  promotions,
  vatEnabled,
  pricesIncludeTax,
  inCart,
  onClose,
  onQty,
  onRemove,
  onSwap,
}: {
  line: PosCartLine;
  /** This line's figures from the sale calculation. */
  saleLine?: { shelf: number; promotionDiscount: number; discount: number; taxable: number; tax: number; gross: number };
  /** Names of offers applied in this sale (for the "offer" note). */
  promotions: { nameEn: string }[];
  vatEnabled: boolean;
  pricesIncludeTax: boolean;
  /** Units of a size / colour already in the sale (other lines included). */
  inCart: (key: string) => number;
  onClose: () => void;
  onQty: (qty: number) => void;
  onRemove: () => void;
  onSwap: (next: Omit<PosCartLine, "quantity">) => void;
}) {
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [imageIdx, setImageIdx] = useState(0);
  const [pick, setPick] = useState<string | null>(null);
  const [showDesc, setShowDesc] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch(`/api/products/${line.productId}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => alive && d.success && setProduct(d.data))
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [line.productId]);

  const variant = product?.variants.find((v) => v.id === line.variantId) ?? null;

  // This colour's photos first, then the rest.
  const images = useMemo(() => {
    const all = product?.images?.length ? product.images : line.imageUrl ? [{ url: line.imageUrl }] : [];
    const mine = all.filter((i) => "color" in i && i.color && line.color && i.color === line.color);
    const rest = all.filter((i) => !mine.includes(i));
    return [...mine, ...rest].map((i) => i.url);
  }, [product, line.imageUrl, line.color]);
  useEffect(() => setImageIdx(0), [images.length]);

  // Every sellable size / colour of this product, as POS lines.
  const options = useMemo(() => {
    if (!product) return [];
    const base = Number(product.salePrice ?? product.basePrice);
    return product.variants
      .filter((v) => v.isActive)
      .map((v) => ({
        productId: product.id,
        variantId: v.id,
        nameEn: product.nameEn,
        nameAr: product.nameAr,
        color: v.color,
        colorParts: v.colorParts,
        size: v.size,
        sku: v.sku,
        barcode: v.barcode || product.barcode || null,
        unitPrice: r3(base + Number(v.priceAdjustment)),
        stock: v.inventory?.quantity ?? 0,
        imageUrl: line.imageUrl,
        tax: line.tax,
        categoryIds: line.categoryIds,
        onSale: line.onSale,
        colorHex: v.colorHex,
      }));
  }, [product, line.imageUrl, line.tax, line.categoryIds, line.onSale]);

  const key = keyOf(line);
  const maxQty = line.stock === null ? 999 : Math.max(line.quantity, line.stock - (inCart(key) - line.quantity));
  const free = (o: { variantId: string | null; productId: string; stock: number | null }) =>
    o.stock === null ? Infinity : o.stock - inCart(keyOf(o));
  const picked = options.find((o) => o.variantId === pick) ?? null;

  const basePrice = product ? r3(Number(product.basePrice) + Number(variant?.priceAdjustment ?? 0)) : null;
  const wasPrice = basePrice != null && basePrice > line.unitPrice + 0.0005 ? basePrice : null;
  const shelf = saleLine?.shelf ?? r3(line.unitPrice * line.quantity);
  const offer = saleLine?.promotionDiscount ?? 0;
  const otherDiscount = saleLine ? r3(saleLine.discount - saleLine.promotionDiscount) : 0;
  const lineTotal = saleLine ? saleLine.gross : r3(shelf - offer);
  const colourParts = variant?.colorParts ?? line.colorParts ?? [];
  const variantText = formatVariantLabel(line) || "Standard";

  return (
    <PosModal
      open
      onClose={onClose}
      size="2xl"
      title={<span className="flex items-center gap-2"><LuShoppingBag size={18} className="text-rose-500" /> Item in this sale</span>}
      footer={
        <>
          <button onClick={onRemove} className="mr-auto inline-flex items-center gap-2 rounded-xl bg-rose-50 px-4 py-2.5 font-medium text-rose-600 hover:bg-rose-100">
            <LuTrash2 size={16} /> Remove from sale
          </button>
          <button onClick={onClose} className="rounded-xl bg-slate-800 px-6 py-2.5 font-medium text-white hover:bg-slate-900">Done</button>
        </>
      }
    >
      <div className="grid gap-6 md:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        {/* Photos */}
        <div className="space-y-3">
          <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-slate-100">
            {images[imageIdx] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={images[imageIdx]} alt={line.nameEn} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-slate-300"><LuShoppingBag size={48} /></div>
            )}
            {images.length > 1 && (
              <>
                <button
                  onClick={() => setImageIdx((i) => (i - 1 + images.length) % images.length)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow hover:bg-white"
                  aria-label="Previous photo"
                >
                  <LuChevronLeft size={20} />
                </button>
                <button
                  onClick={() => setImageIdx((i) => (i + 1) % images.length)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow hover:bg-white"
                  aria-label="Next photo"
                >
                  <LuChevronRight size={20} />
                </button>
                <span className="absolute bottom-3 right-3 rounded-full bg-slate-900/70 px-2.5 py-1 text-xs font-medium text-white">
                  {imageIdx + 1} / {images.length}
                </span>
              </>
            )}
          </div>
          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
              {images.map((url, i) => (
                <button
                  key={url + i}
                  onClick={() => setImageIdx(i)}
                  className={`h-20 w-16 shrink-0 overflow-hidden rounded-xl ring-2 ${i === imageIdx ? "ring-rose-400" : "ring-transparent opacity-70 hover:opacity-100"}`}
                  aria-label={`Photo ${i + 1}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Details */}
        <div className="min-w-0 space-y-5">
          <div>
            {product?.category?.nameEn && <p className="text-xs font-medium uppercase tracking-wider text-slate-400">{product.category.nameEn}</p>}
            <h2 className="text-2xl font-semibold leading-tight text-slate-900">{line.nameEn}</h2>
            {line.nameAr && line.nameAr !== line.nameEn && <p dir="rtl" className="mt-0.5 text-lg text-slate-600">{line.nameAr}</p>}
          </div>

          <div className="flex items-end gap-3">
            <span className="text-3xl font-bold tabular-nums text-slate-900">{omr(line.unitPrice)}</span>
            {wasPrice != null && <span className="pb-1 text-base tabular-nums text-slate-400 line-through">{wasPrice.toFixed(3)}</span>}
            <span className="pb-1 text-sm text-slate-500">each</span>
          </div>

          {/* Selected option */}
          <div className="rounded-2xl border border-slate-200 p-4 space-y-2">
            <div className="flex items-center gap-2">
              {variant?.colorHex && <span className="h-6 w-6 rounded-full border border-slate-200" style={{ background: variant.colorHex }} />}
              <span className="font-medium text-slate-800">{variantText}</span>
            </div>
            {colourParts.length > 0 && (
              <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-slate-600">
                {colourParts.map((cp, i) => {
                  const hex = (cp as { colorHex?: string | null }).colorHex;
                  return (
                  <li key={i} className="flex items-center gap-1.5">
                    {hex && <span className="h-3 w-3 rounded-full border border-slate-200" style={{ background: hex }} />}
                    <span className="text-slate-400">{cp.part}:</span> {cp.color}
                  </li>
                  );
                })}
              </ul>
            )}
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <dt className="text-slate-400">SKU</dt>
              <dd className="font-mono text-slate-700">{line.sku || "-"}</dd>
              <dt className="text-slate-400">In stock</dt>
              <dd className="text-slate-700">
                {line.stock === null ? "Not stock-tracked" : `${line.stock} · ${Math.max(0, line.stock - inCart(key))} left after this sale`}
              </dd>
              {vatEnabled && line.tax && (
                <>
                  <dt className="text-slate-400">VAT</dt>
                  <dd className="text-slate-700">{rateLabel(line.tax)} {pricesIncludeTax ? "(included)" : "(added)"}</dd>
                </>
              )}
            </dl>
            {line.barcode && (
              <div className="pt-1">
                <div className="h-14 max-w-[260px]">
                  <BarcodePreview value={line.barcode} height={44} fontSize={12} margin={2} className="h-full w-full" />
                </div>
              </div>
            )}
          </div>

          {/* Switch size / colour */}
          {options.length > 1 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-700">Change size / colour</p>
              <div className="flex flex-wrap gap-2">
                {options.map((o) => {
                  const left = free(o) + (o.variantId === line.variantId ? line.quantity : 0);
                  const current = o.variantId === line.variantId;
                  const disabled = !current && left <= 0;
                  return (
                    <button
                      key={o.variantId}
                      onClick={() => setPick(current ? null : o.variantId)}
                      disabled={disabled}
                      className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium ${
                        current
                          ? "bg-slate-800 text-white"
                          : pick === o.variantId
                            ? "bg-rose-500 text-white"
                            : disabled
                              ? "cursor-not-allowed bg-slate-50 text-slate-300 line-through"
                              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      {o.colorHex && <span className="h-3.5 w-3.5 rounded-full border border-white/60" style={{ background: o.colorHex }} />}
                      {shortLabel(o)}
                      <span className={`text-[11px] ${current || pick === o.variantId ? "text-white/80" : "text-slate-400"}`}>
                        {current ? "in sale" : left === Infinity ? "" : `${left} left`}
                      </span>
                    </button>
                  );
                })}
              </div>
              {picked && (
                <button
                  onClick={() => {
                    const { colorHex: _hex, ...next } = picked;
                    void _hex;
                    onSwap(next);
                    setPick(null);
                  }}
                  className="inline-flex items-center gap-2 rounded-xl bg-rose-500 px-4 py-2.5 font-semibold text-white hover:bg-rose-600"
                >
                  <LuRefreshCw size={16} /> Switch to {shortLabel(picked)} · {omr(picked.unitPrice)}
                </button>
              )}
            </div>
          )}
          {loading && !product && (
            <p className="flex items-center gap-2 text-sm text-slate-400"><LuLoaderCircle size={15} className="animate-spin" /> Loading product details…</p>
          )}

          {/* Quantity + line total */}
          <div className="rounded-2xl bg-slate-50 p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-slate-700">Quantity</span>
              <div className="flex items-center rounded-xl border border-slate-200 bg-white">
                <button onClick={() => onQty(line.quantity - 1)} disabled={line.quantity <= 1} className="flex h-11 w-11 items-center justify-center text-slate-600 disabled:opacity-30" aria-label="One less">
                  <LuMinus size={18} />
                </button>
                <span className="w-12 text-center text-lg font-semibold tabular-nums">{line.quantity}</span>
                <button onClick={() => onQty(line.quantity + 1)} disabled={line.quantity >= maxQty} className="flex h-11 w-11 items-center justify-center text-slate-600 disabled:opacity-30" aria-label="One more">
                  <LuPlus size={18} />
                </button>
              </div>
            </div>
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between text-slate-600">
                <dt>{line.quantity} × {line.unitPrice.toFixed(3)}</dt>
                <dd className="tabular-nums">{shelf.toFixed(3)}</dd>
              </div>
              {offer > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <dt className="flex items-center gap-1"><LuTag size={13} /> Offer{promotions.length ? ` · ${promotions.map((p) => p.nameEn).join(", ")}` : ""}</dt>
                  <dd className="tabular-nums">−{offer.toFixed(3)}</dd>
                </div>
              )}
              {otherDiscount > 0.0005 && (
                <div className="flex justify-between text-emerald-700">
                  <dt>Share of sale discount</dt>
                  <dd className="tabular-nums">−{otherDiscount.toFixed(3)}</dd>
                </div>
              )}
              {vatEnabled && saleLine && saleLine.tax > 0 && (
                <div className="flex justify-between text-slate-500">
                  <dt>{pricesIncludeTax ? "Includes VAT" : "VAT"}</dt>
                  <dd className="tabular-nums">{pricesIncludeTax ? "" : "+"}{saleLine.tax.toFixed(3)}</dd>
                </div>
              )}
              <div className="flex justify-between border-t border-slate-200 pt-1.5 text-base font-semibold text-slate-900">
                <dt>Line total</dt>
                <dd className="tabular-nums">{omr(lineTotal)}</dd>
              </div>
            </dl>
          </div>

          {(product?.descriptionEn || product?.descriptionAr) && (
            <div className="text-sm text-slate-600">
              <p className={showDesc ? "whitespace-pre-line" : "line-clamp-3 whitespace-pre-line"}>{product.descriptionEn || product.descriptionAr}</p>
              <button onClick={() => setShowDesc((v) => !v)} className="mt-1 text-xs font-medium text-rose-600 hover:underline">
                {showDesc ? "Show less" : "Show full description"}
              </button>
            </div>
          )}
        </div>
      </div>
    </PosModal>
  );
}
