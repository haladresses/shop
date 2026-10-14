"use client";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useDispatch } from "react-redux";
import { AppDispatch, useAppSelector } from "@/redux/store";
import { addItemToCart } from "@/redux/features/cart-slice";
import { updateproductDetails } from "@/redux/features/product-details";
import { useLanguage } from "@/app/context/LanguageContext";
import { flyToCart } from "@/lib/cartFx";
import { WishlistButton } from "@/components/Common/ProductActions";
import QuickAddSheet from "@/components/Common/QuickAddSheet";
import { Product } from "@/types/product";

/**
 * Storefront product card — portrait photo (second photo on hover), sale /
 * new / sold-out badges, always-visible heart, colour swatches and a quick-add
 * that asks for size/colour when the product has options.
 */
export default function ProductCard({ item, priority = false }: { item: Product; priority?: boolean }) {
  const dispatch = useDispatch<AppDispatch>();
  const { isArabic } = useLanguage();
  const [picking, setPicking] = useState(false);
  const inCart = useAppSelector((s) => s.cartReducer.items.filter((c) => c.productId === item.id).reduce((n, c) => n + c.quantity, 0));

  const href = item.slug ? `/shop-details?slug=${item.slug}` : "/shop";
  const images = item.imgs?.previews ?? [];
  const primary = images[0];
  const secondary = images[1];
  const onSale = item.discountedPrice < item.price;
  const off = onSale ? Math.round((1 - item.discountedPrice / item.price) * 100) : 0;
  const soldOut = item.inStock === false;
  const options = item.options ?? [];
  const needsChoice = options.length > 1;
  const currency = isArabic ? "ر.ع." : "OMR";
  const t = (en: string, ar: string) => (isArabic ? ar : en);

  const quickAdd = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (soldOut) return;
    if (needsChoice) return setPicking(true);
    const only = options[0];
    flyToCart(e.currentTarget, primary);
    dispatch(
      addItemToCart({
        ...item,
        quantity: 1,
        ...(only
          ? {
              variantId: only.variantId,
              color: only.color || undefined,
              colorHex: only.colorHex || undefined,
              size: only.size || undefined,
              price: item.price + only.priceAdjustment,
              discountedPrice: item.discountedPrice + only.priceAdjustment,
            }
          : {}),
      } as never),
    );
  };

  const swatches = item.colors ?? [];

  return (
    <article data-fx-card data-reveal className="group relative flex flex-col">
      <div className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-[#F4EFEB]">
        <Link href={href} onClick={() => dispatch(updateproductDetails({ ...item }))} aria-label={item.title} className="absolute inset-0">
          {primary && (
            <Image
              src={primary}
              alt={item.title}
              fill
              priority={priority}
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 290px"
              className={`object-cover object-top transition duration-[900ms] ease-out group-hover:scale-[1.04] ${secondary ? "[@media(hover:hover)]:group-hover:opacity-0" : ""} ${soldOut ? "grayscale opacity-60" : ""}`}
            />
          )}
          {secondary && (
            <Image
              src={secondary}
              alt=""
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 290px"
              className="object-cover object-top opacity-0 transition duration-[900ms] ease-out scale-[1.04] [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-hover:scale-100"
            />
          )}
        </Link>

        {/* Badges */}
        <div className="absolute top-2.5 start-2.5 flex flex-col items-start gap-1.5 pointer-events-none">
          {soldOut ? (
            <span className="rounded-full bg-dark/85 text-white text-[10px] sm:text-[11px] font-semibold px-2.5 py-1">{t("Sold out", "نفدت")}</span>
          ) : (
            <>
              {onSale && <span className="rounded-full bg-blue text-white text-[10px] sm:text-[11px] font-bold px-2.5 py-1">−{off}%</span>}
              {item.isNew && !onSale && <span className="rounded-full bg-white/95 text-dark text-[10px] sm:text-[11px] font-semibold px-2.5 py-1 shadow-sm">{t("New", "جديد")}</span>}
            </>
          )}
        </div>

        {/* Heart — always visible, fills when saved */}
        <WishlistButton
          item={item}
          size={17}
          className="absolute top-2 end-2 w-9 h-9 rounded-full bg-white/90 backdrop-blur flex items-center justify-center text-dark shadow-sm hover:scale-105 transition"
        />

        {/* Quick add — round bag on touch, slide-up bar on hover devices */}
        {!soldOut && (
          <>
            <button
              onClick={quickAdd}
              aria-label={t("Add to cart", "أضيفي للسلة")}
              className="fx-press [@media(hover:hover)]:hidden absolute bottom-2 end-2 w-10 h-10 rounded-full bg-white/95 text-dark shadow-md flex items-center justify-center"
            >
              <BagIcon filled={inCart > 0} />
              {inCart > 0 && (
                <span key={inCart} className="fx-badge-pop absolute -top-1 -end-1 min-w-[18px] h-[18px] px-1 rounded-full bg-blue text-white text-[10px] font-bold flex items-center justify-center">
                  {inCart}
                </span>
              )}
            </button>
            <div className="hidden [@media(hover:hover)]:block absolute inset-x-2.5 bottom-2.5 translate-y-[130%] group-hover:translate-y-0 group-focus-within:translate-y-0 transition-transform duration-300 ease-out">
              <button
                onClick={quickAdd}
                className="fx-press w-full h-11 rounded-xl bg-white/95 backdrop-blur text-dark text-sm font-semibold shadow-lg flex items-center justify-center gap-2 hover:bg-dark hover:text-white transition-colors"
              >
                <BagIcon filled={inCart > 0} />
                {needsChoice ? t("Quick add · choose size", "إضافة سريعة · اختاري المقاس") : t("Add to cart", "أضيفي للسلة")}
                {inCart > 0 && <span className="text-xs opacity-70">({inCart})</span>}
              </button>
            </div>
          </>
        )}
      </div>

      <div className="pt-3 px-0.5 flex flex-col gap-1">
        {item.categoryName && <p className="text-[11px] uppercase tracking-wider text-dark-4 truncate">{item.categoryName}</p>}
        <Link href={href} className="text-[13px] sm:text-[15px] leading-snug text-dark font-medium line-clamp-2 hover:text-blue transition-colors">
          {item.title}
        </Link>
        <div className="flex items-baseline flex-wrap gap-x-2 gap-y-0.5 mt-0.5">
          <span className={`font-semibold text-sm sm:text-base ${onSale ? "text-blue" : "text-dark"}`}>
            {item.discountedPrice.toFixed(3)} <span className="text-[11px] font-medium">{currency}</span>
          </span>
          {onSale && <span className="text-xs sm:text-sm text-dark-4 line-through">{item.price.toFixed(3)}</span>}
        </div>
        {swatches.length > 1 && (
          <div className="flex items-center gap-1.5 mt-1" aria-label={t("Colours", "الألوان")}>
            {swatches.slice(0, 5).map((c) => (
              <span key={c.name} title={c.name} className="w-3.5 h-3.5 rounded-full ring-1 ring-black/10" style={{ background: c.hex || "#ddd" }} />
            ))}
            {swatches.length > 5 && <span className="text-[11px] text-dark-4">+{swatches.length - 5}</span>}
          </div>
        )}
      </div>

      {picking && <QuickAddSheet item={item} onClose={() => setPicking(false)} />}
    </article>
  );
}

function BagIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden>
      <path d="M6 7h12l-1 13H7L6 7z" fill={filled ? "currentColor" : "none"} fillOpacity={filled ? 0.15 : 0} stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M9 7V6a3 3 0 016 0v1" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      {filled && <path d="M9.5 13.5l2 2 3.5-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  );
}
