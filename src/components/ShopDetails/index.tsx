"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useDispatch } from "react-redux";
import Breadcrumb from "../Common/Breadcrumb";
import Newsletter from "../Common/Newsletter";
import RecentlyViewdItems from "./RecentlyViewd";
import { usePreviewSlider } from "@/app/context/PreviewSliderContext";
import { useLanguage } from "@/app/context/LanguageContext";
import { AppDispatch } from "@/redux/store";
import { addItemToCart } from "@/redux/features/cart-slice";
import { updateproductDetails } from "@/redux/features/product-details";
import {
  fetchProductBySlug,
  mapApiProduct,
  type ApiProduct,
  type ApiProductVariant,
} from "@/lib/storefront";
import {
  normalizeAttributes,
  formatAttributeValue,
  type ProductAttributes,
  type CategoryAttribute,
} from "@/lib/attributes";
import { flyToCart } from "@/lib/cartFx";
import { WishlistButton } from "@/components/Common/ProductActions";

const StarIcon = ({ filled }: { filled: boolean }) => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className={filled ? "fill-[#FFA645]" : "fill-gray-4"}>
    <path d="M16.7906 6.72187L11.7 5.93438L9.39377 1.09688C9.22502 0.759375 8.77502 0.759375 8.60627 1.09688L6.30002 5.9625L1.23752 6.72187C0.871891 6.77812 0.731266 7.25625 1.01252 7.50938L4.69689 11.3063L3.82502 16.6219C3.76877 16.9875 4.13439 17.2969 4.47189 17.0719L9.05627 14.5687L13.6125 17.0719C13.9219 17.2406 14.3156 16.9594 14.2313 16.6219L13.3594 11.3063L17.0438 7.50938C17.2688 7.25625 17.1563 6.77812 16.7906 6.72187Z" fill="" />
  </svg>
);

const Chevron = ({ dir }: { dir: "left" | "right" }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className={dir === "left" ? "rotate-180" : ""}>
    <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const pick = (en: string, ar: string, isArabic: boolean) => (isArabic ? ar || en : en);

const GALLERY_PLACEHOLDER = "/images/products/p1.png";

const ShopDetails = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { isArabic } = useLanguage();
  const { openPreviewModal } = usePreviewSlider();
  const currency = isArabic ? "ر.ع." : "OMR";

  const [api, setApi] = useState<ApiProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [activeImg, setActiveImg] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [activeVariant, setActiveVariant] = useState<ApiProductVariant | null>(null);
  const [activeSize, setActiveSize] = useState<string>("");
  // Shown when the shopper taps "Add to cart" before choosing an option.
  const [choiceError, setChoiceError] = useState("");
  const touchX = useRef<number | null>(null);
  const [activeTab, setActiveTab] = useState<"description" | "specs" | "reviews" | "whatsapp">("description");
  const [waReviews, setWaReviews] = useState<
    { id: string; imageUrl: string; customerName: string | null; caption: string | null }[]
  >([]);
  const [waLightbox, setWaLightbox] = useState<string | null>(null);

  useEffect(() => {
    const slug = new URLSearchParams(window.location.search).get("slug");
    if (!slug) { setLoading(false); setNotFound(true); return; }
    let ignore = false;
    const controller = new AbortController();
    setLoading(true);
    setNotFound(false);
    fetchProductBySlug(slug, controller.signal)
      .then((data) => {
        if (ignore) return;
        if (data) setApi(data);
        else setNotFound(true);
      })
      .catch((e) => {
        // Ignore aborts (React Strict Mode remounts) - only real failures are "not found".
        if (ignore || (e as Error)?.name === "AbortError") return;
        setNotFound(true);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => { ignore = true; controller.abort(); };
  }, []);

  // Mapped storefront product (for cart/wishlist/preview slider).
  const product = useMemo(
    () => (api ? mapApiProduct(api, isArabic ? "ar" : "en") : null),
    [api, isArabic]
  );

  // Keep the redux product-details in sync so the zoom slider shows real images.
  useEffect(() => {
    if (product) dispatch(updateproductDetails({ ...product }));
  }, [product, dispatch]);

  // WhatsApp review screenshots for this product.
  useEffect(() => {
    if (!api?.id) return;
    let ignore = false;
    fetch(`/api/products/${api.id}/whatsapp-reviews`)
      .then((r) => r.json())
      .then((d) => {
        if (!ignore && d.success) setWaReviews(d.data);
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, [api?.id]);

  // All product images, primary first then by sortOrder (mirrors mapApiProduct's ordering).
  const sortedImages = useMemo(() => {
    const imgs = api?.images ?? [];
    return [...imgs].sort((a, b) => {
      if (a.isPrimary && !b.isPrimary) return -1;
      if (!a.isPrimary && b.isPrimary) return 1;
      return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
    });
  }, [api]);

  // When a color is selected, prefer images tagged with that color; fall back
  // to the full gallery when that color has no dedicated photos.
  const images = useMemo(() => {
    const activeColor = activeVariant?.color;
    const matched = activeColor
      ? sortedImages.filter((img) => img.color && img.color === activeColor)
      : [];
    const list = (matched.length > 0 ? matched : sortedImages).map((img) => img.url).filter(Boolean);
    return list.length > 0 ? list : [GALLERY_PLACEHOLDER];
  }, [sortedImages, activeVariant]);

  useEffect(() => setChoiceError(""), [activeVariant, activeSize]);

  // Jump back to the first (color-matched) photo whenever the color selection changes.
  useEffect(() => {
    setActiveImg(0);
  }, [activeVariant?.color]);


  // Variants: distinct colors + sizes.
  const variants = (api?.variants ?? []).filter((v) => v.isActive !== false);
  // Identifies a variant's color option, whether it's a flat color or a
  // multi-area breakdown (e.g. yellow sleeves + blue body) with no flat color set.
  const colorKey = (v: ApiProductVariant) => {
    const partsKey = (v.colorParts || []).map((p) => `${p.part}:${p.color}`).join("|");
    return v.colorHex || v.color || partsKey;
  };
  const colorVariants = useMemo(() => {
    const seen = new Set<string>();
    return variants.filter((v) => {
      const key = colorKey(v);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [variants]);
  const sizes = useMemo(() => {
    const set = new Set<string>();
    variants.forEach((v) => v.size && set.add(v.size));
    return Array.from(set);
  }, [variants]);

  // The exact sellable variant for the chosen colour + size — the colour
  // swatch alone may belong to a different size, so never use it directly.
  const selectedVariant = useMemo(() => {
    if (variants.length === 0) return null;
    const needsColor = colorVariants.length > 1;
    const needsSize = sizes.length > 0;
    if ((needsColor && !activeVariant) || (needsSize && !activeSize)) return null;
    return (
      variants.find(
        (v) => (!activeVariant || colorKey(v) === colorKey(activeVariant)) && (!needsSize || v.size === activeSize),
      ) ?? null
    );
  }, [variants, colorVariants.length, sizes.length, activeVariant, activeSize]);

  // Stock of one size within the chosen colour (for disabling sold-out sizes).
  const sizeStock = (size: string) =>
    variants
      .filter((v) => v.size === size && (!activeVariant || colorKey(v) === colorKey(activeVariant)))
      .reduce((n, v) => n + (v.inventory?.quantity ?? 0), 0);

  // Pricing (respect the selected variant's adjustment).
  const adjust = selectedVariant?.priceAdjustment != null ? Number(selectedVariant.priceAdjustment) : activeVariant?.priceAdjustment != null ? Number(activeVariant.priceAdjustment) : 0;
  const base = (Number(api?.basePrice) || 0) + adjust;
  const sale = api?.salePrice != null ? Number(api.salePrice) + adjust : base;
  const hasDiscount = sale < base;
  const discountPct = hasDiscount ? Math.round(((base - sale) / base) * 100) : 0;

  // Stock for the current selection (or overall when no variants).
  const selectedStock = useMemo(() => {
    if (variants.length === 0) return null;
    const matching = variants.filter(
      (v) =>
        (!activeVariant || colorKey(v) === colorKey(activeVariant)) &&
        (!activeSize || v.size === activeSize)
    );
    return matching.reduce((sum, v) => sum + (v.inventory?.quantity ?? 0), 0);
  }, [variants, activeVariant, activeSize]);

  // Dynamic specifications: category definitions + stored values.
  const attrDefs: CategoryAttribute[] = useMemo(
    () => normalizeAttributes(api?.category?.attributes ?? []),
    [api]
  );
  const attrValues: ProductAttributes = useMemo(
    () => (api?.attributes as ProductAttributes) ?? {},
    [api]
  );
  const specs = useMemo(
    () =>
      attrDefs
        .map((def) => ({
          label: pick(def.labelEn, def.labelAr, isArabic),
          value: formatAttributeValue(def, attrValues[def.key], isArabic),
        }))
        .filter((s) => s.value !== ""),
    [attrDefs, attrValues, isArabic]
  );

  const title = api ? pick(api.nameEn, api.nameAr, isArabic) : "";
  const description = api ? pick(api.descriptionEn ?? "", api.descriptionAr ?? "", isArabic) : "";

  const handleAddToCart = (e?: React.MouseEvent) => {
    if (!product) return;
    if (variants.length > 0 && !selectedVariant) {
      setChoiceError(
        sizes.length > 0 && !activeSize
          ? isArabic ? "اختاري المقاس أولاً" : "Please choose a size"
          : isArabic ? "اختاري اللون أولاً" : "Please choose a colour",
      );
      document.getElementById("pdp-options")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (selectedVariant && (selectedVariant.inventory?.quantity ?? 0) < quantity) {
      setChoiceError(isArabic ? "الكمية المطلوبة غير متوفرة" : "Not enough stock for this option");
      return;
    }
    setChoiceError("");
    flyToCart(e?.currentTarget ?? null, images[0]);
    const v = selectedVariant;
    dispatch(
      addItemToCart({
        ...product,
        // Reflect the selected variant's price adjustment, not the base product price.
        price: base,
        discountedPrice: sale,
        variantId: v?.id,
        color: v?.color || undefined,
        colorHex: v?.colorHex || undefined,
        colorParts: v?.colorParts || undefined,
        size: v?.size || undefined,
        quantity,
      } as never)
    );
  };

  const handleZoom = () => {
    if (product) dispatch(updateproductDetails({ ...product }));
    openPreviewModal();
  };

  const step = (delta: number) => setQuantity((q) => Math.max(1, q + delta));

  if (loading) {
    return (
      <>
        <Breadcrumb title={isArabic ? "تفاصيل المنتج" : "Shop Details"} pages={[isArabic ? "تفاصيل المنتج" : "shop details"]} />
        <div className="flex justify-center items-center py-40">
          <div className="w-10 h-10 rounded-full border-2 border-blue border-t-transparent animate-spin" />
        </div>
      </>
    );
  }

  if (notFound || !api || !product) {
    return (
      <>
        <Breadcrumb title={isArabic ? "تفاصيل المنتج" : "Shop Details"} pages={[isArabic ? "تفاصيل المنتج" : "shop details"]} />
        <div className="text-center py-40 text-dark-4">
          {isArabic ? "لم يتم العثور على المنتج." : "Product not found."}
        </div>
      </>
    );
  }

  return (
    <>
      <Breadcrumb
        title={isArabic ? "تفاصيل المنتج" : "Shop Details"}
        pages={[isArabic ? "المتجر" : "shop", "/", title]}
      />

      <section className="overflow-hidden relative pb-20 pt-5 lg:pt-20 xl:pt-28">
        <div className="max-w-[1170px] w-full mx-auto px-4 sm:px-8 xl:px-0" dir={isArabic ? "rtl" : "ltr"}>
          <div className="flex flex-col lg:flex-row gap-7.5 xl:gap-17.5">
            {/* Gallery */}
            <div className="lg:max-w-[570px] w-full">
              <div
                className="relative w-full aspect-[3/4] -mx-4 sm:mx-0 w-[calc(100%+2rem)] sm:w-full sm:rounded-2xl bg-[#F4EFEB] overflow-hidden flex items-center justify-center group"
                onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
                onTouchEnd={(e) => {
                  // Swipe between photos on phones (direction-aware for RTL).
                  if (touchX.current === null || images.length < 2) return;
                  const dx = e.changedTouches[0].clientX - touchX.current;
                  touchX.current = null;
                  if (Math.abs(dx) < 40) return;
                  const forward = isArabic ? dx > 0 : dx < 0;
                  setActiveImg((i) => (i + (forward ? 1 : -1) + images.length) % images.length);
                }}
              >
                <button
                  onClick={handleZoom}
                  aria-label="zoom"
                  className="w-10 h-10 rounded-full bg-white/90 backdrop-blur shadow-1 flex items-center justify-center duration-200 text-dark hover:text-blue absolute top-4 lg:top-6 end-4 lg:end-6 z-40"
                >
                  <svg className="fill-current" width="22" height="22" viewBox="0 0 22 22" fill="none">
                    <path fillRule="evenodd" clipRule="evenodd" d="M9.16665 1.14581C9.54634 1.14581 9.85415 1.45362 9.85415 1.83331C9.85415 2.21301 9.54634 2.52081 9.16665 2.52081C7.41873 2.52081 6.17695 2.52227 5.23492 2.64893C4.31268 2.77292 3.78133 3.00545 3.39339 3.39339C3.00545 3.78133 2.77292 4.31268 2.64893 5.23492C2.52227 6.17695 2.52081 7.41873 2.52081 9.16665C2.52081 9.54634 2.21301 9.85415 1.83331 9.85415C1.45362 9.85415 1.14581 9.54634 1.14581 9.16665C1.1458 7.43032 1.14579 6.09599 1.28619 5.05171C1.43068 3.97699 1.73512 3.10712 2.42112 2.42112C3.10712 1.73512 3.97699 1.43068 5.05171 1.28619C6.09599 1.14579 7.43032 1.1458 9.16665 1.14581ZM1.83331 12.1458C2.21301 12.1458 2.52081 12.4536 2.52081 12.8333C2.52081 14.5812 2.52227 15.823 2.64893 16.765C2.77292 17.6873 3.00545 18.2186 3.39339 18.6066C3.78133 18.9945 4.31268 19.227 5.23492 19.351C6.17695 19.4777 7.41873 19.4791 9.16665 19.4791C9.54634 19.4791 9.85415 19.787 9.85415 20.1666C9.85415 20.5463 9.54634 20.8541 9.16665 20.8541C7.43032 20.8542 6.09599 20.8542 5.05171 20.7138C3.97699 20.5693 3.10712 20.2648 2.42112 19.5788C1.73512 18.8928 1.43068 18.023 1.28619 16.9483C1.14579 15.904 1.1458 14.5696 1.14581 12.8333C1.14581 12.4536 1.45362 12.1458 1.83331 12.1458ZM20.1666 12.1458C20.5463 12.1458 20.8541 12.4536 20.8541 12.8333C20.8542 14.5696 20.8542 15.904 20.7138 16.9483C20.5693 18.023 20.2648 18.8928 19.5788 19.5788C18.8928 20.2648 18.023 20.5693 16.9483 20.7138C15.904 20.8542 14.5696 20.8542 12.885 20.8541H12.8333C12.4536 20.8541 12.1458 20.5463 12.1458 20.1666C12.1458 19.787 12.4536 19.4791 12.8333 19.4791C14.5812 19.4791 15.823 19.4777 16.765 19.351C17.6873 19.227 18.2186 18.9945 18.6066 18.6066C18.9945 18.2186 19.227 17.6873 19.351 16.765C19.4777 15.823 19.4791 14.5812 19.4791 12.8333C19.4791 12.4536 19.787 12.1458 20.1666 12.1458ZM16.9483 1.28619C18.023 1.43068 18.8928 1.73512 19.5788 2.42112C20.2648 3.10712 20.5693 3.97699 20.7138 5.05171C20.8542 6.09599 20.8542 7.43032 20.8541 9.11494V9.16665C20.8541 9.54634 20.5463 9.85415 20.1666 9.85415C19.787 9.85415 19.4791 9.54634 19.4791 9.16665C19.4791 7.41873 19.4777 6.17695 19.351 5.23492C19.227 4.31268 18.9945 3.78133 18.6066 3.39339C18.2186 3.00545 17.6873 2.77292 16.765 2.64893C15.823 2.52227 14.5812 2.52081 12.8333 2.52081C12.4536 2.52081 12.1458 2.21301 12.1458 1.83331C12.1458 1.45362 12.4536 1.14581 12.8333 1.14581C14.5696 1.1458 15.904 1.14579 16.9483 1.28619Z" fill="" />
                  </svg>
                </button>

                {hasDiscount && (
                  <span className="absolute top-4 lg:top-6 start-4 lg:start-6 z-40 inline-flex font-semibold text-custom-sm text-white bg-blue rounded-full py-1 px-3">
                    {discountPct}% {isArabic ? "خصم" : "OFF"}
                  </span>
                )}

                {images.length > 1 && (
                  <>
                    <button
                      onClick={() => setActiveImg((i) => (i - 1 + images.length) % images.length)}
                      aria-label="previous image"
                      className="absolute left-3 top-1/2 -translate-y-1/2 z-30 w-9 h-9 rounded-full bg-white shadow-1 flex items-center justify-center text-dark hover:text-blue opacity-0 group-hover:opacity-100 duration-200"
                    >
                      <Chevron dir="left" />
                    </button>
                    <button
                      onClick={() => setActiveImg((i) => (i + 1) % images.length)}
                      aria-label="next image"
                      className="absolute right-3 top-1/2 -translate-y-1/2 z-30 w-9 h-9 rounded-full bg-white shadow-1 flex items-center justify-center text-dark hover:text-blue opacity-0 group-hover:opacity-100 duration-200"
                    >
                      <Chevron dir="right" />
                    </button>
                  </>
                )}

                {images[activeImg] && (
                  <Image
                    key={images[activeImg]}
                    src={images[activeImg]}
                    alt={title}
                    fill
                    sizes="(max-width: 1024px) 100vw, 570px"
                    className="object-cover object-top pdp-img-in"
                    priority
                  />
                )}

                {images.length > 1 && (
                  <div className="lg:hidden absolute bottom-3 inset-x-0 flex justify-center gap-1.5 z-30">
                    {images.map((_, i) => (
                      <span key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === activeImg ? "w-5 bg-white" : "w-1.5 bg-white/60"}`} />
                    ))}
                  </div>
                )}
              </div>

              {images.length > 1 && (
                <div className="hidden lg:flex flex-wrap gap-3 mt-6">
                  {images.map((src, key) => (
                    <button
                      onClick={() => setActiveImg(key)}
                      key={key}
                      aria-label={`view image ${key + 1}`}
                      className={`flex items-center justify-center w-15 sm:w-20 h-15 sm:h-20 overflow-hidden rounded-lg bg-gray-2 shadow-1 duration-200 border-2 hover:border-blue ${
                        key === activeImg ? "border-blue" : "border-transparent"
                      }`}
                    >
                      <Image width={70} height={70} src={src} alt="thumbnail" className="object-cover w-full h-full" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Content */}
            <div className="max-w-[539px] w-full">
              <div className="flex items-center justify-between gap-3 mb-3">
                <h1 className="font-semibold text-xl sm:text-2xl xl:text-custom-3 text-dark">{title}</h1>
              </div>

              <div className="flex flex-wrap items-center gap-4 mb-5">
                {product.reviews > 0 && (
                  <div className="flex items-center gap-2.5">
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <StarIcon key={i} filled={i < 5} />
                      ))}
                    </div>
                    <span className="text-custom-sm text-dark-4">
                      ({product.reviews} {isArabic ? "تقييم" : "reviews"})
                    </span>
                  </div>
                )}
                {variants.length === 0 || (selectedStock ?? 0) > 0 ? (
                  <span className="inline-flex items-center gap-1.5 text-custom-sm text-green">
                    <span className="w-2 h-2 rounded-full bg-green" />
                    {isArabic ? "متوفر" : "In Stock"}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-custom-sm text-red">
                    <span className="w-2 h-2 rounded-full bg-red" />
                    {isArabic ? "غير متوفر" : "Out of Stock"}
                  </span>
                )}
              </div>

              {description && (
                <p className="text-dark-4 leading-relaxed mb-6 line-clamp-4">{description}</p>
              )}

              <div className="flex items-end gap-3 mb-6">
                <span className="font-bold text-2xl xl:text-3xl text-dark">
                  {sale.toFixed(3)} <span className="text-lg font-medium text-dark-4">{currency}</span>
                </span>
                {hasDiscount && (
                  <span className="text-dark-4 text-lg line-through mb-0.5">{base.toFixed(3)}</span>
                )}
              </div>

              <div id="pdp-options">
              {/* Colors */}
              {colorVariants.length > 0 && (
                <div className="mb-5">
                  <h4 className="font-medium text-dark mb-2.5">
                    {isArabic ? "اللون" : "Color"}
                    {activeVariant?.color && <span className="text-dark-4 font-normal"> : {activeVariant.color}</span>}
                  </h4>
                  <div className="flex flex-wrap items-center gap-2.5">
                    {colorVariants.map((v) => {
                      const active = !!activeVariant && colorKey(activeVariant) === colorKey(v);
                      const parts = v.colorParts || [];
                      // Multi-color option (e.g. yellow sleeves + blue body): render a pie-slice
                      // swatch of each area's color instead of one flat fill.
                      const swatchBg =
                        parts.length > 1
                          ? `conic-gradient(${parts
                              .map(
                                (p, i) =>
                                  `${p.colorHex || "#ccc"} ${(i * 360) / parts.length}deg ${
                                    ((i + 1) * 360) / parts.length
                                  }deg`
                              )
                              .join(", ")})`
                          : v.colorHex || "#ccc";
                      const label = v.color || parts.map((p) => `${p.part}: ${p.color}`).join(", ");
                      return (
                        <button
                          key={v.id}
                          onClick={() => setActiveVariant(active ? null : v)}
                          title={label}
                          aria-label={label || "color"}
                          className={`w-9 h-9 rounded-full flex items-center justify-center border-2 duration-200 ${
                            active ? "border-blue" : "border-transparent hover:border-gray-4"
                          }`}
                        >
                          <span className="w-7 h-7 rounded-full border border-gray-3" style={{ background: swatchBg }} />
                        </button>
                      );
                    })}
                  </div>
                  {activeVariant?.colorParts && activeVariant.colorParts.length > 0 && (
                    <p className="mt-2 text-custom-sm text-dark-4">
                      {activeVariant.colorParts.map((p) => `${p.part}: ${p.color}`).join(isArabic ? " · " : " · ")}
                    </p>
                  )}
                </div>
              )}

              {/* Sizes */}
              {sizes.length > 0 && (
                <div className="mb-5">
                  <h4 className="font-medium text-dark mb-2.5">{isArabic ? "المقاس" : "Size"}</h4>
                  <div className="flex flex-wrap items-center gap-2.5">
                    {sizes.map((s) => {
                      const active = activeSize === s;
                      const left = sizeStock(s);
                      return (
                        <button
                          key={s}
                          disabled={left <= 0}
                          onClick={() => setActiveSize(active ? "" : s)}
                          aria-pressed={active}
                          className={`relative min-w-[52px] h-12 px-3 rounded-xl border text-sm font-medium duration-200 ${
                            active ? "border-dark bg-dark text-white" : "border-gray-3 text-dark hover:border-dark"
                          } disabled:opacity-40 disabled:line-through disabled:cursor-not-allowed disabled:hover:border-gray-3`}
                        >
                          {s}
                          {left > 0 && left <= 2 && (
                            <span className="absolute -top-2 start-1/2 -translate-x-1/2 rtl:translate-x-1/2 whitespace-nowrap rounded-full bg-[#F59E0B] text-white text-[9px] font-semibold px-1.5">
                              {isArabic ? `بقي ${left}` : `${left} left`}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {choiceError && (
                <p role="alert" className="pos-shake mb-4 text-sm font-medium text-red">{choiceError}</p>
              )}
              </div>

              {/* Quick specs preview */}
              {specs.length > 0 && (
                <div className="mb-6 rounded-lg border border-gray-3 divide-y divide-gray-3">
                  {specs.slice(0, 4).map((s) => (
                    <div key={s.label} className="flex items-center justify-between gap-4 px-4 py-2.5">
                      <span className="text-custom-sm text-dark-4">{s.label}</span>
                      <span className="text-custom-sm font-medium text-dark text-right">{s.value}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Quantity + actions */}
              <div className="flex flex-wrap items-center gap-4 mb-4">
                <div className="flex items-center rounded-md border border-gray-3">
                  <button onClick={() => step(-1)} aria-label="decrease" className="w-11 h-11 flex items-center justify-center text-dark hover:text-blue text-xl">-</button>
                  <span className="w-12 text-center font-medium text-dark">{quantity}</span>
                  <button onClick={() => step(1)} aria-label="increase" className="w-11 h-11 flex items-center justify-center text-dark hover:text-blue text-xl">+</button>
                </div>

                <button
                  onClick={handleAddToCart}
                  disabled={variants.length > 0 && selectedVariant !== null && (selectedVariant.inventory?.quantity ?? 0) <= 0}
                  className="fx-press flex-1 min-w-[180px] inline-flex items-center justify-center gap-2 font-semibold text-white bg-dark h-12 px-7 rounded-full hover:bg-blue duration-200 disabled:bg-gray-4"
                >
                  {isArabic ? "أضيفي إلى السلة" : "Add to cart"} · {(sale * quantity).toFixed(3)} {currency}
                </button>

                {product && (
                  <WishlistButton
                    item={product}
                    size={22}
                    className="flex items-center justify-center w-12 h-12 rounded-md border border-gray-3 text-dark hover:text-blue hover:border-blue duration-200"
                  />
                )}
              </div>

              {api.sku && (
                <p className="text-custom-sm text-dark-4">
                  {isArabic ? "رمز المنتج" : "SKU"}: <span className="text-dark">{api.sku}</span>
                </p>
              )}
              {api.category && (
                <p className="text-custom-sm text-dark-4">
                  {isArabic ? "الفئة" : "Category"}:{" "}
                  <span className="text-dark">{pick(api.category.nameEn, api.category.nameAr ?? "", isArabic)}</span>
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Sticky buy bar — phones/tablets */}
      <div className="lg:hidden fixed inset-x-0 bottom-0 z-[9990] bg-white/95 backdrop-blur-md border-t border-gray-3 px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))]" dir={isArabic ? "rtl" : "ltr"}>
        <div className="flex items-center gap-3 max-w-[560px] mx-auto">
          <div className="min-w-0">
            <p className="font-bold text-dark leading-tight">{sale.toFixed(3)} <span className="text-xs font-medium">{currency}</span></p>
            <p className="text-[11px] text-dark-4 truncate">
              {selectedVariant ? [selectedVariant.color, selectedVariant.size].filter(Boolean).join(" · ") : hasDiscount ? <span className="line-through">{base.toFixed(3)}</span> : sizes.length ? (isArabic ? "اختاري المقاس" : "Choose a size") : ""}
            </p>
          </div>
          <WishlistButton item={product} size={20} className="shrink-0 w-12 h-12 rounded-full border border-gray-3 flex items-center justify-center text-dark" />
          <button onClick={handleAddToCart} className="fx-press flex-1 h-12 rounded-full bg-dark text-white font-semibold text-[15px] active:bg-blue">
            {isArabic ? "أضيفي للسلة" : "Add to cart"}
          </button>
        </div>
      </div>
      <div className="lg:hidden h-[84px]" aria-hidden />

      {/* Tabs */}
      <section className="overflow-hidden bg-gray-2 py-12 lg:py-20">
        <div className="max-w-[1170px] w-full mx-auto px-4 sm:px-8 xl:px-0" dir={isArabic ? "rtl" : "ltr"}>
          <div className="flex flex-wrap items-center gap-3 mb-9">
            {([
              ["description", isArabic ? "الوصف" : "Description"],
              ["specs", isArabic ? "المواصفات" : "Specifications"],
              ["reviews", `${isArabic ? "التقييمات" : "Reviews"} (${product.reviews})`],
              ["whatsapp", `${isArabic ? "تقييمات واتساب" : "WhatsApp Reviews"} (${waReviews.length})`],
            ] as const).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`font-medium text-custom-sm py-2.5 px-5 rounded-md duration-200 ${
                  activeTab === id ? "bg-blue text-white" : "bg-white text-dark hover:text-blue"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-xl shadow-1 p-6 sm:p-9">
            {activeTab === "description" && (
              <div className="text-dark-4 leading-relaxed whitespace-pre-line">
                {description || (isArabic ? "لا يوجد وصف لهذا المنتج." : "No description available for this product.")}
              </div>
            )}

            {activeTab === "specs" && (
              specs.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10">
                  {specs.map((s) => (
                    <div key={s.label} className="flex items-center justify-between gap-4 py-3 border-b border-gray-3">
                      <span className="text-dark-4">{s.label}</span>
                      <span className="font-medium text-dark text-right">{s.value}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-dark-4">{isArabic ? "لا توجد مواصفات." : "No specifications available."}</p>
              )
            )}

            {activeTab === "reviews" && (
              <div className="text-dark-4">
                {product.reviews > 0
                  ? `${product.reviews} ${isArabic ? "تقييم لهذا المنتج." : "review(s) for this product."}`
                  : isArabic
                  ? "لا توجد تقييمات بعد."
                  : "No reviews yet."}
              </div>
            )}

            {activeTab === "whatsapp" && (
              waReviews.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {waReviews.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setWaLightbox(r.imageUrl)}
                      className="group text-left overflow-hidden rounded-xl border border-gray-3 bg-white hover:shadow-1 transition-shadow"
                    >
                      <div className="relative aspect-[3/4] bg-gray-1 overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={r.imageUrl}
                          alt={r.customerName || "WhatsApp review"}
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                        />
                      </div>
                      {(r.customerName || r.caption) && (
                        <div className="p-2.5">
                          {r.customerName && <div className="text-custom-sm font-medium text-dark">{r.customerName}</div>}
                          {r.caption && <div className="mt-0.5 text-custom-xs text-dark-4 line-clamp-2">{r.caption}</div>}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-dark-4">
                  {isArabic ? "لا توجد تقييمات واتساب بعد." : "No WhatsApp reviews yet."}
                </p>
              )
            )}
          </div>
        </div>
      </section>

      <RecentlyViewdItems categorySlug={api.category?.slug} excludeId={api.id} />
      <Newsletter />

      {/* WhatsApp review lightbox */}
      {waLightbox && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setWaLightbox(null)}
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
        >
          <button
            type="button"
            onClick={() => setWaLightbox(null)}
            aria-label="Close"
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <svg width="18" height="18" viewBox="0 0 14 14" fill="none">
              <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={waLightbox}
            alt="WhatsApp review"
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] max-w-[92vw] rounded-xl object-contain shadow-2xl"
          />
        </div>
      )}
    </>
  );
};

export default ShopDetails;
