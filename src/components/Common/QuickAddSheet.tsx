"use client";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import { useDispatch } from "react-redux";
import { AppDispatch } from "@/redux/store";
import { addItemToCart } from "@/redux/features/cart-slice";
import { useLanguage } from "@/app/context/LanguageContext";
import { flyToCart } from "@/lib/cartFx";
import { Product, ProductOption } from "@/types/product";

const SIZE_RANK: Record<string, number> = { XXS: 0, XS: 1, S: 2, M: 3, L: 4, XL: 5, XXL: 6, "3XL": 7 };
const sizeSort = (a: string, b: string) => {
  const ra = SIZE_RANK[a.toUpperCase()] ?? 50 + (parseFloat(a) || 0);
  const rb = SIZE_RANK[b.toUpperCase()] ?? 50 + (parseFloat(b) || 0);
  return ra - rb || a.localeCompare(b);
};

/**
 * Quick-add picker for products with options: colour + size chips with live
 * stock, quantity, then add — without leaving the grid. Bottom sheet on
 * phones, compact dialog on larger screens. Rendered in a portal so card
 * transforms/animations never clip it.
 */
export default function QuickAddSheet({ item, onClose }: { item: Product; onClose: () => void }) {
  const dispatch = useDispatch<AppDispatch>();
  const { isArabic } = useLanguage();
  const options = useMemo(() => item.options ?? [], [item.options]);
  const colors = useMemo(() => Array.from(new Set(options.map((o) => o.color).filter((c): c is string => !!c))), [options]);
  const firstInStock = options.find((o) => o.stock > 0);
  const [color, setColor] = useState<string | null>(firstInStock?.color ?? colors[0] ?? null);
  const sizesForColor = useMemo(
    () => options.filter((o) => (colors.length ? o.color === color : true)).filter((o) => o.size).sort((a, b) => sizeSort(a.size!, b.size!)),
    [options, colors.length, color],
  );
  const [size, setSize] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [closing, setClosing] = useState(false);

  // Pick the first available size whenever the colour changes.
  useEffect(() => {
    const s = sizesForColor.find((o) => o.stock > 0) ?? sizesForColor[0];
    setSize(s?.size ?? null);
  }, [sizesForColor]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const close = () => {
    setClosing(true);
    setTimeout(onClose, 220);
  };

  const selected: ProductOption | undefined = options.find(
    (o) => (colors.length ? o.color === color : true) && (sizesForColor.length ? o.size === size : true),
  );
  const stock = selected?.stock ?? 0;
  const unitPrice = item.discountedPrice + (selected?.priceAdjustment ?? 0);
  const listPrice = item.price + (selected?.priceAdjustment ?? 0);
  const currency = isArabic ? "ر.ع." : "OMR";
  const image = item.imgs?.previews?.[0];

  const add = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!selected || stock <= 0) return;
    flyToCart(e.currentTarget, image);
    dispatch(
      addItemToCart({
        ...item,
        price: listPrice,
        discountedPrice: unitPrice,
        variantId: selected.variantId,
        color: selected.color || undefined,
        colorHex: selected.colorHex || undefined,
        size: selected.size || undefined,
        quantity: qty,
      } as never),
    );
    close();
  };

  const t = (en: string, ar: string) => (isArabic ? ar : en);

  return createPortal(
    <div className="fixed inset-0 z-[99990] flex items-end sm:items-center justify-center" dir={isArabic ? "rtl" : "ltr"} role="dialog" aria-modal="true" aria-label={item.title}>
      <div className={`absolute inset-0 bg-dark/50 backdrop-blur-[2px] transition-opacity duration-200 ${closing ? "opacity-0" : "qa-fade"}`} onClick={close} />
      <div
        className={`relative w-full sm:max-w-[440px] bg-white rounded-t-[28px] sm:rounded-3xl shadow-2xl max-h-[88dvh] overflow-y-auto pb-[env(safe-area-inset-bottom)] ${closing ? "qa-out" : "qa-in"}`}
      >
        <div className="sm:hidden flex justify-center pt-2.5">
          <span className="w-10 h-1.5 rounded-full bg-gray-3" />
        </div>
        <div className="flex gap-4 p-5 pb-4">
          {image && (
            <div className="relative w-20 h-[106px] rounded-xl overflow-hidden bg-[#F4EFEB] shrink-0">
              <Image src={image} alt="" fill sizes="80px" className="object-cover" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="font-medium text-dark leading-snug line-clamp-2">{item.title}</p>
            <div className="flex items-baseline gap-2 mt-1.5">
              <span className="font-semibold text-dark text-lg">{unitPrice.toFixed(3)} <span className="text-xs font-normal">{currency}</span></span>
              {listPrice > unitPrice && <span className="text-sm text-dark-4 line-through">{listPrice.toFixed(3)}</span>}
            </div>
            <Link href={item.slug ? `/shop-details?slug=${item.slug}` : "/shop"} onClick={close} className="inline-block mt-1.5 text-xs font-medium text-blue underline underline-offset-2">
              {t("View full details", "عرض كل التفاصيل")}
            </Link>
          </div>
          <button onClick={close} aria-label={t("Close", "إغلاق")} className="self-start -m-1 p-2 rounded-full text-dark-4 hover:bg-gray-1 hover:text-dark">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
          </button>
        </div>

        <div className="px-5 space-y-5">
          {colors.length > 0 && (
            <div>
              <p className="text-sm font-medium text-dark mb-2">
                {t("Colour", "اللون")}: <span className="text-dark-4 font-normal">{color}</span>
              </p>
              <div className="flex flex-wrap gap-2.5">
                {colors.map((c) => {
                  const hex = options.find((o) => o.color === c)?.colorHex;
                  const anyStock = options.some((o) => o.color === c && o.stock > 0);
                  return (
                    <button
                      key={c}
                      onClick={() => setColor(c)}
                      aria-label={c}
                      aria-pressed={color === c}
                      title={c}
                      className={`relative w-10 h-10 rounded-full p-[3px] transition ${color === c ? "ring-2 ring-blue/50" : "ring-1 ring-gray-3 hover:ring-dark-4"} ${anyStock ? "" : "opacity-40"}`}
                    >
                      <span className="block w-full h-full rounded-full border border-black/10" style={{ background: hex || "#ddd" }} />
                      {!anyStock && <span className="absolute inset-0 m-auto w-[120%] h-px bg-dark-4 rotate-45" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {sizesForColor.length > 0 && (
            <div>
              <p className="text-sm font-medium text-dark mb-2">{t("Size", "المقاس")}</p>
              <div className="grid grid-cols-4 gap-2">
                {sizesForColor.map((o) => (
                  <button
                    key={o.variantId}
                    disabled={o.stock <= 0}
                    onClick={() => setSize(o.size)}
                    aria-pressed={size === o.size}
                    className={`relative h-11 rounded-xl text-sm font-medium border transition ${
                      size === o.size ? "bg-dark text-white border-dark" : "border-gray-3 text-dark hover:border-blue/50"
                    } disabled:opacity-40 disabled:line-through disabled:hover:border-gray-3`}
                  >
                    {o.size}
                    {o.stock > 0 && o.stock <= 2 && (
                      <span className="absolute -top-2 start-1/2 -translate-x-1/2 rtl:translate-x-1/2 whitespace-nowrap rounded-full bg-[#F59E0B] text-white text-[9px] font-semibold px-1.5">
                        {t(`${o.stock} left`, `بقي ${o.stock}`)}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-dark">{t("Quantity", "الكمية")}</p>
            <div className="flex items-center rounded-full border border-gray-3">
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="w-10 h-10 flex items-center justify-center text-dark-3 disabled:opacity-30" disabled={qty <= 1} aria-label="−">−</button>
              <span className="w-8 text-center font-semibold tabular-nums">{qty}</span>
              <button onClick={() => setQty((q) => Math.min(Math.max(1, stock), q + 1))} disabled={qty >= stock} className="w-10 h-10 flex items-center justify-center text-dark-3 disabled:opacity-30" aria-label="+">+</button>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-white px-5 pt-4 pb-5 mt-2">
          <button
            onClick={add}
            disabled={!selected || stock <= 0}
            className="fx-press w-full h-13 py-3.5 rounded-full bg-dark text-white font-semibold flex items-center justify-center gap-2 transition hover:bg-blue disabled:bg-gray-4 disabled:cursor-not-allowed"
          >
            {!selected || stock <= 0
              ? t("Sold out", "نفدت الكمية")
              : `${t("Add to cart", "أضيفي للسلة")} · ${(unitPrice * qty).toFixed(3)} ${currency}`}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * Add-to-cart that never skips the size/colour choice: products with options
 * open the picker; simple products are added directly. When the caller only
 * has a thin product (e.g. from the wishlist), its options are fetched first.
 */
export function useSmartAdd(item: Product) {
  const dispatch = useDispatch<AppDispatch>();
  const [sheetItem, setSheetItem] = useState<Product | null>(null);
  const [busy, setBusy] = useState(false);

  const add = async (e?: React.MouseEvent<HTMLElement>) => {
    const from = e?.currentTarget ?? null;
    let full = item;
    if (!item.options) {
      setBusy(true);
      try {
        const d = await fetch(`/api/products/${item.id}`).then((r) => r.json());
        if (d.success) {
          const { mapApiProduct } = await import("@/lib/storefront");
          full = { ...mapApiProduct(d.data), title: item.title || mapApiProduct(d.data).title };
        }
      } catch {
        /* fall back to the thin item */
      } finally {
        setBusy(false);
      }
    }
    if (full.options && full.options.length > 0) {
      setSheetItem(full);
      return;
    }
    flyToCart(from, full.imgs?.previews?.[0]);
    dispatch(addItemToCart({ ...full, quantity: 1 } as never));
  };

  const sheet = sheetItem ? <QuickAddSheet item={sheetItem} onClose={() => setSheetItem(null)} /> : null;
  return { add, sheet, busy };
}
