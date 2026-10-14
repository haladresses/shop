"use client";
import { useState } from "react";
import { useDispatch } from "react-redux";
import { AppDispatch, useAppSelector } from "@/redux/store";
import { addItemToCart } from "@/redux/features/cart-slice";
import { addItemToWishlist, removeItemFromWishlist } from "@/redux/features/wishlist-slice";
import { useLanguage } from "@/app/context/LanguageContext";
import { flyToCart, flyToWishlist, burst } from "@/lib/cartFx";
import { Product } from "@/types/product";

const HEART_PATH =
  "M12 20.5s-7-4.3-9-8.7C1.6 8.7 3.4 5 7 5c2 0 3.3 1.1 4.1 2.2C11.9 6.1 13.2 5 15.2 5c3.6 0 5.4 3.7 4 6.8-2 4.4-7.2 8.7-7.2 8.7z";

/**
 * Heart toggle. Filled + popping once the product is in the wishlist (state is
 * read live from the store, so every card showing the product updates at
 * once); a click on a filled heart removes it again.
 */
export function WishlistButton({ item, className = "", size = 16 }: { item: Product; className?: string; size?: number }) {
  const dispatch = useDispatch<AppDispatch>();
  const { isArabic } = useLanguage();
  const saved = useAppSelector((s) => s.wishlistReducer.items.some((w) => w.id === item.id));
  const [popKey, setPopKey] = useState(0);

  const toggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (saved) {
      dispatch(removeItemFromWishlist(item.id));
    } else {
      flyToWishlist(e.currentTarget);
      dispatch(addItemToWishlist({ ...item, status: "available", quantity: 1 } as never));
    }
    setPopKey((k) => k + 1);
  };

  const label = saved ? (isArabic ? "إزالة من المفضلة" : "Remove from wishlist") : isArabic ? "أضيفي إلى المفضلة" : "Add to wishlist";
  return (
    <button type="button" onClick={toggle} aria-pressed={saved} aria-label={label} title={label} className={`fx-press ${className}`}>
      <svg key={popKey} width={size} height={size} viewBox="0 0 24 24" aria-hidden className={popKey ? "fx-heart-pop" : ""}>
        <path
          d={HEART_PATH}
          fill={saved ? "#E0475F" : "none"}
          stroke={saved ? "#E0475F" : "currentColor"}
          strokeWidth="1.8"
          strokeLinejoin="round"
          style={{ transition: "fill .25s ease, stroke .25s ease" }}
        />
      </svg>
    </button>
  );
}

/**
 * Add-to-cart button that flies the product photo into the header cart and
 * then shows an "in cart" state (filled bag + quantity) for that product.
 */
export function AddToCartButton({
  item,
  className = "",
  compactLabel = false,
  onAdded,
}: {
  item: Product;
  className?: string;
  /** Short "Add" label on small screens. */
  compactLabel?: boolean;
  onAdded?: () => void;
}) {
  const dispatch = useDispatch<AppDispatch>();
  const { isArabic } = useLanguage();
  const inCart = useAppSelector((s) => s.cartReducer.items.filter((c) => c.productId === item.id || c.id === item.id).reduce((n, c) => n + c.quantity, 0));
  const [justAdded, setJustAdded] = useState(0);

  const add = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    flyToCart(e.currentTarget, item.imgs?.previews?.[0] ?? item.imgs?.thumbnails?.[0]);
    dispatch(addItemToCart({ ...item, quantity: 1 } as never));
    setJustAdded((k) => k + 1);
    burst(e.currentTarget, { count: 8, spread: 26 });
    onAdded?.();
  };

  // Several of the same product can be added — show how many are in the cart.
  const label = inCart > 0 ? (isArabic ? `${inCart} في السلة · أضيفي` : `${inCart} in cart · add`) : isArabic ? "أضيفي للسلة" : "Add to cart";
  return (
    <button type="button" onClick={add} className={`fx-press relative ${className}`} aria-label={isArabic ? "أضيفي للسلة" : "Add to cart"}>
      <span key={justAdded} className={`inline-flex ${justAdded ? "fx-heart-pop" : ""}`}>
        <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden>
          <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4H6z" fill={inCart > 0 ? "currentColor" : "none"} fillOpacity={inCart > 0 ? 0.25 : 0} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          <line x1="3" y1="6" x2="21" y2="6" stroke="currentColor" strokeWidth="2" />
          {inCart > 0 ? (
            <path d="M8.5 13.5l2.5 2.5 4.5-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          ) : (
            <path d="M16 10a4 4 0 01-8 0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          )}
        </svg>
      </span>
      <span key={`l${inCart}`} className={`${compactLabel ? "hidden sm:inline" : ""} ${inCart ? "fx-badge-pop" : ""}`}>{label}</span>
      {compactLabel && (
        <span className="sm:hidden">{inCart > 0 ? `×${inCart}` : isArabic ? "أضيفي" : "Add"}</span>
      )}
    </button>
  );
}
