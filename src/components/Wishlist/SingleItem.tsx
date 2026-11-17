import React from "react";
import Image from "next/image";
import { useDispatch } from "react-redux";
import { AppDispatch } from "@/redux/store";
import { removeItemFromWishlist } from "@/redux/features/wishlist-slice";
import { useLanguage } from "@/app/context/LanguageContext";
import { useSmartAdd } from "@/components/Common/QuickAddSheet";

type WishlistLine = {
  id: string;
  title: string;
  price: number;
  discountedPrice: number;
  imgs?: { thumbnails: string[]; previews: string[] };
};

/** One saved product: photo, name, price, add to cart and remove. */
const SingleItem = ({ item }: { item: WishlistLine }) => {
  const dispatch = useDispatch<AppDispatch>();
  const { isArabic } = useLanguage();
  const t = (en: string, ar: string) => (isArabic ? ar : en);
  const currency = t("OMR", "ر.ع.");
  const unit = Number(item.discountedPrice);
  const onSale = Number(item.price) > unit;
  const image = item.imgs?.thumbnails?.[0] || item.imgs?.previews?.[0];

  // Products with sizes/colours open the option picker first.
  const smart = useSmartAdd(item as never);

  return (
    <div className="flex gap-4 py-5">
      <div className="relative shrink-0 w-[72px] h-[96px] rounded-xl bg-[#F4EFEB] overflow-hidden">
        {image && <Image src={image} alt={item.title} fill sizes="72px" className="object-cover object-top" />}
      </div>

      <div className="min-w-0 flex-1 flex flex-col">
        <p className="font-medium text-dark text-sm sm:text-base leading-snug line-clamp-2">{item.title}</p>
        <p className="mt-1 text-sm text-dark">
          {unit.toFixed(3)} {currency}
          {onSale && <span className="ms-2 text-dark-4 line-through">{Number(item.price).toFixed(3)}</span>}
        </p>

        <div className="mt-auto pt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
          <button
            type="button"
            onClick={(e) => smart.add(e)}
            disabled={smart.busy}
            className="fx-press inline-flex items-center justify-center font-medium text-sm text-white bg-dark py-2 px-5 rounded-full ease-out duration-200 hover:bg-blue disabled:opacity-60"
          >
            {t("Add to cart", "أضيفي للسلة")}
          </button>
          <button
            type="button"
            onClick={() => dispatch(removeItemFromWishlist(item.id))}
            className="text-sm text-dark-4 ease-out duration-200 hover:text-red"
          >
            {t("Remove", "إزالة")}
          </button>
        </div>
      </div>
      {smart.sheet}
    </div>
  );
};

export default SingleItem;
