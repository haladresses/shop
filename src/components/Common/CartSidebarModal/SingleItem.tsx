"use client";
import Image from "next/image";
import Link from "next/link";
import { useDispatch } from "react-redux";
import { AppDispatch } from "@/redux/store";
import { removeItemFromCart as removeAction, updateCartItemQuantity } from "@/redux/features/cart-slice";
import { useLanguage } from "@/app/context/LanguageContext";
import { formatVariantLabel } from "@/lib/utils";

type CartLine = {
  id: string;
  slug?: string;
  title: string;
  discountedPrice: number;
  price: number;
  quantity: number;
  color?: string;
  colorParts?: { part: string; color: string }[];
  size?: string;
  imgs?: { thumbnails: string[]; previews: string[] };
};

/** One line in the cart drawer: photo with quantity badge, options, stepper and line total. */
const SingleItem = ({ item }: { item: CartLine; removeItemFromCart?: unknown }) => {
  const dispatch = useDispatch<AppDispatch>();
  const { isArabic } = useLanguage();
  const currency = isArabic ? "ر.ع." : "OMR";
  const variantLabel = formatVariantLabel(item);
  const unit = Number(item.discountedPrice);
  const onSale = Number(item.price) > unit;
  const href = item.slug ? `/shop-details?slug=${item.slug}` : "#";

  const setQty = (q: number) => {
    if (q <= 0) dispatch(removeAction(item.id));
    else dispatch(updateCartItemQuantity({ id: item.id, quantity: q }));
  };

  return (
    <div className="flex gap-3.5">
      <Link href={href} className="relative shrink-0 w-[78px] h-[104px] rounded-xl bg-[#F4EFEB] overflow-hidden">
        {item.imgs?.thumbnails?.[0] && (
          <Image src={item.imgs.thumbnails[0]} alt={item.title} fill sizes="78px" className="object-cover object-top" />
        )}
        <span key={item.quantity} className="fx-badge-pop !delay-0 absolute top-1.5 end-1.5 min-w-[22px] h-[22px] px-1.5 rounded-full bg-dark text-white text-[11px] font-bold flex items-center justify-center shadow">
          ×{item.quantity}
        </span>
      </Link>

      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex items-start justify-between gap-2">
          <Link href={href} className="font-medium text-dark text-sm leading-snug line-clamp-2 hover:text-blue">
            {item.title}
          </Link>
          <button
            onClick={() => dispatch(removeAction(item.id))}
            aria-label={isArabic ? "إزالة" : "Remove"}
            className="shrink-0 -m-1 p-1.5 rounded-full text-dark-4 hover:text-red hover:bg-red-light-6 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 002 2h6a2 2 0 002-2l1-12M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
        {variantLabel && <p className="text-xs text-dark-4 mt-0.5 truncate">{variantLabel}</p>}
        <p className="text-xs text-dark-4 mt-0.5">
          {unit.toFixed(3)} {currency}
          {onSale && <span className="line-through ms-1.5">{Number(item.price).toFixed(3)}</span>}
        </p>

        <div className="mt-auto pt-2 flex items-center justify-between gap-2">
          <div className="flex items-center rounded-full border border-gray-3" aria-label={isArabic ? "الكمية" : "Quantity"}>
            <button onClick={() => setQty(item.quantity - 1)} aria-label={isArabic ? "إنقاص" : "Decrease"} className="w-8 h-8 flex items-center justify-center text-dark-3 hover:text-blue">
              {item.quantity <= 1 ? (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M4 7h16M6 7l1 12a2 2 0 002 2h6a2 2 0 002-2l1-12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
              ) : (
                "−"
              )}
            </button>
            <span className="min-w-[28px] text-center text-sm font-semibold tabular-nums">{item.quantity}</span>
            <button onClick={() => setQty(item.quantity + 1)} aria-label={isArabic ? "زيادة" : "Increase"} className="w-8 h-8 flex items-center justify-center text-dark-3 hover:text-blue">
              +
            </button>
          </div>
          <span className="font-semibold text-dark text-sm tabular-nums">
            {(unit * item.quantity).toFixed(3)} <span className="text-[11px] font-medium">{currency}</span>
          </span>
        </div>
      </div>
    </div>
  );
};

export default SingleItem;
