"use client";
import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Breadcrumb from "../Common/Breadcrumb";
import { useAppSelector, AppDispatch } from "@/redux/store";
import { useDispatch } from "react-redux";
import {
  selectTotalPrice,
  removeAllItemsFromCart,
} from "@/redux/features/cart-slice";
import { useLanguage } from "@/app/context/LanguageContext";
import { formatVariantLabel } from "@/lib/utils";

type PaymentMethod = "CASH_ON_DELIVERY" | "BANK_TRANSFER" | "THAWANI";
type ShippingMethod = "STANDARD" | "WASELLEE" | "STORE_PICKUP";
type WaselleeDeliveryType = "HOME_DELIVERY" | "OFFICE_PICKUP";

type StoreInfo = {
  store_name_en?: string;
  store_name_ar?: string;
  store_address?: string;
  store_phone?: string;
};

type WaselleeBranch = {
  id: string;
  cityEn: string;
  cityAr: string;
  regionEn: string;
  regionAr: string;
  phone: string;
  // Prisma Decimal fields serialize as strings over JSON.
  homeDeliveryCost: number | string;
  officePickupCost: number | string;
  isActive: boolean;
};

const FREE_SHIPPING_THRESHOLD = 10;
const SHIPPING_COST = 1.5;

/** Server-priced summary (POST /api/checkout/quote) — offers, delivery and VAT exactly as they'll be charged. */
type Quote = {
  subtotal: number;
  promotionDiscount: number;
  discount: number;
  shipping: number;
  taxTotal: number;
  total: number;
  vatEnabled: boolean;
  pricesIncludeTax: boolean;
  showOnStorefront: boolean;
  appliedPromotions: { id: string; nameEn: string; nameAr: string; discount: number }[];
  hints: { promotionId: string; messageEn: string; messageAr: string }[];
  lines: { promotionDiscount: number; gross: number }[];
};

const Checkout = () => {
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const { isArabic } = useLanguage();
  const currency = isArabic ? "ر.ع." : "OMR";
  const t = (en: string, ar: string) => (isArabic ? ar : en);

  const cartItems = useAppSelector((state) => state.cartReducer.items);
  const subtotal = useAppSelector(selectTotalPrice);

  const [branches, setBranches] = useState<WaselleeBranch[]>([]);
  const [shippingMethod, setShippingMethod] = useState<ShippingMethod>("STANDARD");
  const [waselleeDeliveryType, setWaselleeDeliveryType] =
    useState<WaselleeDeliveryType>("HOME_DELIVERY");
  const [waselleeBranchId, setWaselleeBranchId] = useState("");
  const [storeInfo, setStoreInfo] = useState<StoreInfo>({});

  useEffect(() => {
    fetch("/api/wasellee/branches")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setBranches(d.data.filter((b: WaselleeBranch) => b.isActive));
      })
      .catch(() => {});

    fetch("/api/settings?group=general")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setStoreInfo(d.data);
      })
      .catch(() => {});
  }, []);

  const branchesByRegion = useMemo(() => {
    const groups: Record<string, WaselleeBranch[]> = {};
    for (const b of branches) {
      (groups[isArabic ? b.regionAr : b.regionEn] ||= []).push(b);
    }
    return groups;
  }, [branches, isArabic]);

  const selectedBranch = branches.find((b) => b.id === waselleeBranchId) || null;

  const shippingCost =
    shippingMethod === "STORE_PICKUP"
      ? 0 // Collected in person at the shop. No delivery fee.
      : shippingMethod === "WASELLEE"
      ? selectedBranch
        ? Number(
            waselleeDeliveryType === "OFFICE_PICKUP"
              ? selectedBranch.officePickupCost
              : selectedBranch.homeDeliveryCost
          )
        : 0
      : subtotal >= FREE_SHIPPING_THRESHOLD || subtotal === 0
      ? 0
      : SHIPPING_COST;
  const localTotal = subtotal + shippingCost;

  // Ask the server for the real numbers whenever the cart or delivery changes.
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteError, setQuoteError] = useState("");
  const quoteKey = JSON.stringify([
    cartItems.map((i) => [i.productId, i.variantId ?? null, i.quantity]),
    shippingMethod,
    waselleeBranchId,
    waselleeDeliveryType,
  ]);
  useEffect(() => {
    if (cartItems.length === 0) {
      setQuote(null);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch("/api/checkout/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ctrl.signal,
        body: JSON.stringify({
          items: cartItems.map((i) => ({ productId: i.productId, variantId: i.variantId || null, quantity: i.quantity })),
          shippingMethod,
          waselleeBranchId: shippingMethod === "WASELLEE" ? waselleeBranchId || null : null,
          waselleeDeliveryType: shippingMethod === "WASELLEE" ? waselleeDeliveryType : null,
        }),
      })
        .then((r) => r.json())
        .then((d) => {
          if (d.success) {
            setQuote(d.data);
            setQuoteError("");
          } else {
            setQuote(null);
            setQuoteError(d.error || "");
          }
        })
        .catch(() => {});
    }, 200);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteKey]);

  const shownShipping = quote ? quote.shipping : shippingCost;
  const total = quote ? quote.total : localTotal;
  const showVat = !!quote && quote.vatEnabled && quote.showOnStorefront && quote.taxTotal > 0;

  const [form, setForm] = useState({
    nameEn: "",
    phone: "",
    email: "",
    city: "",
    area: "",
    street: "",
    buildingNo: "",
    notes: "",
    couponCode: "",
  });
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>("THAWANI");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Signed-in customers: fill in their name, mobile, email and default
  // address so checkout is a couple of taps. Guests simply get empty fields.
  useEffect(() => {
    let alive = true;
    (async () => {
      const me = await fetch("/api/account", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      if (!alive || !me?.success) return;
      const list = await fetch("/api/account/addresses", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      const addresses = (list?.success ? list.data : []) as { isDefault?: boolean; nameEn?: string; phone?: string; city?: string; area?: string | null; street?: string | null; buildingNo?: string | null }[];
      const def = addresses.find((a) => a.isDefault) ?? addresses[0];
      if (!alive) return;
      setForm((prev) => ({
        ...prev,
        nameEn: prev.nameEn || def?.nameEn || me.data.nameEn || "",
        phone: prev.phone || def?.phone || me.data.phone || "",
        email: prev.email || me.data.email || "",
        city: prev.city || def?.city || "",
        area: prev.area || def?.area || "",
        street: prev.street || def?.street || "",
        buildingNo: prev.buildingNo || def?.buildingNo || "",
      }));
    })();
    return () => {
      alive = false;
    };
  }, []);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (cartItems.length === 0) {
      setError(t("Your cart is empty.", "سلة التسوق فارغة."));
      return;
    }

    if (shippingMethod === "WASELLEE" && !waselleeBranchId) {
      setError(
        t(
          "Please choose a Wasellee branch/city.",
          "الرجاء اختيار فرع/مدينة وصلي."
        )
      );
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cartItems.map((item) => ({
            productId: item.productId,
            ...(item.variantId ? { variantId: item.variantId } : {}),
            quantity: item.quantity,
          })),
          shippingAddress: {
            nameEn: form.nameEn,
            phone: form.phone,
            city:
              shippingMethod === "WASELLEE" && selectedBranch
                ? selectedBranch.cityEn
                : shippingMethod === "STORE_PICKUP"
                ? t("Store Pickup", "استلام من المتجر")
                : form.city,
            area: form.area || undefined,
            street: form.street || undefined,
            buildingNo: form.buildingNo || undefined,
            country: "OM",
          },
          couponCode: form.couponCode || undefined,
          notes: form.notes || undefined,
          paymentMethod,
          shippingMethod,
          ...(shippingMethod === "WASELLEE"
            ? { waselleeDeliveryType, waselleeBranchId }
            : {}),
          guestName: form.nameEn,
          guestEmail: form.email,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(
          data.error || t("Could not place the order.", "تعذر إتمام الطلب.")
        );
        return;
      }

      const orderId = data.data.id;
      dispatch(removeAllItemsFromCart());

      if (paymentMethod === "THAWANI") {
        const sessionRes = await fetch("/api/payments/thawani/create-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId }),
        });
        const sessionData = await sessionRes.json();
        if (sessionData.success) {
          window.location.href = sessionData.data.redirectUrl;
          return;
        }
        // The order was placed but the Thawani session failed to start —
        // send the customer to the payment-status page, which offers a retry.
        router.push(`/payment/thawani/callback?orderId=${orderId}`);
        return;
      }

      router.push("/mail-success");
    } catch {
      setError(
        t("Something went wrong. Please try again.", "حدث خطأ ما. حاول مرة أخرى.")
      );
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    "rounded-md border border-gray-3 bg-gray-1 placeholder:text-dark-5 w-full py-2.5 px-5 outline-none duration-200 focus:border-transparent focus:shadow-input focus:ring-2 focus:ring-blue/20";

  return (
    <>
      <Breadcrumb title={t("Checkout", "إتمام الطلب")} pages={["checkout"]} />
      <section className="overflow-hidden py-20 bg-gray-2">
        <div className="max-w-[1170px] w-full mx-auto px-4 sm:px-8 xl:px-0">
          <form onSubmit={handleSubmit}>
            <div className="flex flex-col lg:flex-row gap-7.5 xl:gap-11">
              {/* checkout left */}
              <div className="lg:max-w-[670px] w-full">
                <div className="bg-white shadow-1 rounded-[10px] p-4 sm:p-8.5">
                  <h2 className="font-medium text-dark text-xl sm:text-2xl mb-5.5">
                    {t("Shipping details", "تفاصيل الشحن")}
                  </h2>

                  <div className="flex flex-col lg:flex-row gap-5 mb-5">
                    <div className="w-full">
                      <label htmlFor="nameEn" className="block mb-2.5">
                        {t("Full Name", "الاسم الكامل")}{" "}
                        <span className="text-red">*</span>
                      </label>
                      <input
                        type="text"
                        name="nameEn"
                        id="nameEn"
                        required
                        value={form.nameEn}
                        onChange={handleChange}
                        className={inputClass}
                      />
                    </div>
                    <div className="w-full">
                      <label htmlFor="phone" className="block mb-2.5">
                        {t("Phone", "الهاتف")}{" "}
                        <span className="text-red">*</span>
                      </label>
                      <input
                        type="tel"
                        name="phone"
                        id="phone"
                        required
                        value={form.phone}
                        onChange={handleChange}
                        className={inputClass}
                      />
                    </div>
                  </div>

                  <div className="mb-5">
                    <label htmlFor="email" className="block mb-2.5">
                      {t("Email", "البريد الإلكتروني")}{" "}
                      <span className="text-dark-4 text-custom-sm">{t("(optional)", "(اختياري)")}</span>
                    </label>
                    <input
                      type="email"
                      name="email"
                      id="email"
                      autoComplete="email"
                      value={form.email}
                      onChange={handleChange}
                      className={inputClass}
                    />
                  </div>

                  {shippingMethod === "STANDARD" && (
                    <div className="flex flex-col lg:flex-row gap-5 mb-5">
                      <div className="w-full">
                        <label htmlFor="city" className="block mb-2.5">
                          {t("City", "المدينة")}{" "}
                          <span className="text-red">*</span>
                        </label>
                        <input
                          type="text"
                          name="city"
                          id="city"
                          required
                          value={form.city}
                          onChange={handleChange}
                          className={inputClass}
                        />
                      </div>
                      <div className="w-full">
                        <label htmlFor="area" className="block mb-2.5">
                          {t("Area", "المنطقة")}
                        </label>
                        <input
                          type="text"
                          name="area"
                          id="area"
                          value={form.area}
                          onChange={handleChange}
                          className={inputClass}
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col lg:flex-row gap-5 mb-5">
                    <div className="w-full">
                      <label htmlFor="street" className="block mb-2.5">
                        {t("Street", "الشارع")}
                      </label>
                      <input
                        type="text"
                        name="street"
                        id="street"
                        value={form.street}
                        onChange={handleChange}
                        className={inputClass}
                      />
                    </div>
                    <div className="w-full">
                      <label htmlFor="buildingNo" className="block mb-2.5">
                        {t("Building No.", "رقم المبنى")}
                      </label>
                      <input
                        type="text"
                        name="buildingNo"
                        id="buildingNo"
                        value={form.buildingNo}
                        onChange={handleChange}
                        className={inputClass}
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="notes" className="block mb-2.5">
                      {t("Order Notes (optional)", "ملاحظات الطلب (اختياري)")}
                    </label>
                    <textarea
                      name="notes"
                      id="notes"
                      rows={4}
                      value={form.notes}
                      onChange={handleChange}
                      placeholder={t(
                        "Notes about your order, e.g. special notes for delivery.",
                        "ملاحظات حول طلبك، مثل ملاحظات خاصة بالتوصيل."
                      )}
                      className={inputClass}
                    ></textarea>
                  </div>
                </div>

                {/* Shipping method box */}
                <div className="bg-white shadow-1 rounded-[10px] mt-7.5 p-4 sm:p-8.5">
                  <h2 className="font-medium text-dark text-xl sm:text-2xl mb-5.5">
                    {t("Shipping Method", "طريقة الشحن")}
                  </h2>

                  <div className="flex flex-col gap-3 mb-5">
                    {(
                      [
                        ["STANDARD", t("Standard Delivery", "التوصيل العادي")],
                        ["WASELLEE", t("Wasellee (LO Express)", "وصلي (LO Express)")],
                        ["STORE_PICKUP", t("Pickup from Hala Store", "الاستلام من متجر حلا")],
                      ] as [ShippingMethod, string][]
                    ).map(([value, label]) => (
                      <label
                        key={value}
                        className="flex cursor-pointer select-none items-center gap-4"
                      >
                        <input
                          type="radio"
                          name="shippingMethod"
                          value={value}
                          checked={shippingMethod === value}
                          onChange={() => setShippingMethod(value)}
                          className="sr-only"
                        />
                        <span
                          className={`flex h-4 w-4 items-center justify-center rounded-full flex-shrink-0 ${
                            shippingMethod === value
                              ? "border-4 border-blue"
                              : "border border-gray-4"
                          }`}
                        />
                        <span
                          className={`rounded-md border-[0.5px] py-3.5 px-5 w-full ease-out duration-200 ${
                            shippingMethod === value
                              ? "border-transparent bg-gray-2"
                              : "border-gray-4 shadow-1"
                          }`}
                        >
                          {label}
                        </span>
                      </label>
                    ))}
                  </div>

                  {shippingMethod === "WASELLEE" && (
                    <div className="space-y-5">
                      <div className="flex flex-col sm:flex-row gap-3">
                        {(
                          [
                            [
                              "HOME_DELIVERY",
                              t("Home Delivery", "التوصيل لباب المنزل"),
                            ],
                            [
                              "OFFICE_PICKUP",
                              t("Pickup from Branch", "الاستلام من الفرع"),
                            ],
                          ] as [WaselleeDeliveryType, string][]
                        ).map(([value, label]) => (
                          <label
                            key={value}
                            className="flex cursor-pointer select-none items-center gap-3 flex-1"
                          >
                            <input
                              type="radio"
                              name="waselleeDeliveryType"
                              value={value}
                              checked={waselleeDeliveryType === value}
                              onChange={() => setWaselleeDeliveryType(value)}
                              className="sr-only"
                            />
                            <span
                              className={`flex h-4 w-4 items-center justify-center rounded-full flex-shrink-0 ${
                                waselleeDeliveryType === value
                                  ? "border-4 border-blue"
                                  : "border border-gray-4"
                              }`}
                            />
                            <span
                              className={`rounded-md border-[0.5px] py-3 px-4 w-full text-sm ease-out duration-200 ${
                                waselleeDeliveryType === value
                                  ? "border-transparent bg-gray-2"
                                  : "border-gray-4 shadow-1"
                              }`}
                            >
                              {label}
                            </span>
                          </label>
                        ))}
                      </div>

                      <div>
                        <label htmlFor="waselleeBranchId" className="block mb-2.5">
                          {t("Wasellee City / Branch", "مدينة / فرع وصلي")}{" "}
                          <span className="text-red">*</span>
                        </label>
                        <select
                          id="waselleeBranchId"
                          name="waselleeBranchId"
                          required={shippingMethod === "WASELLEE"}
                          value={waselleeBranchId}
                          onChange={(e) => setWaselleeBranchId(e.target.value)}
                          className={inputClass}
                        >
                          <option value="">
                            {t("Select a city/branch...", "اختر مدينة/فرع...")}
                          </option>
                          {Object.entries(branchesByRegion).map(([region, list]) => (
                            <optgroup key={region} label={region}>
                              {list.map((b) => (
                                <option key={b.id} value={b.id}>
                                  {isArabic ? b.cityAr : b.cityEn}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                      </div>

                      {selectedBranch && waselleeDeliveryType === "OFFICE_PICKUP" && (
                        <div className="rounded-md bg-blue-light-5 border border-blue-light-4 px-4 py-3 text-sm text-dark">
                          <p className="font-medium mb-1">
                            {t(
                              "You will collect your package from this Wasellee office:",
                              "سوف تستلم طردك من مكتب وصلي التالي:"
                            )}
                          </p>
                          <p>
                            {isArabic ? selectedBranch.cityAr : selectedBranch.cityEn} ·{" "}
                            <span dir="ltr">{selectedBranch.phone}</span>
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {shippingMethod === "STORE_PICKUP" && (
                    <div className="rounded-md bg-blue-light-5 border border-blue-light-4 px-4 py-3 text-sm text-dark">
                      <p className="font-medium mb-1">
                        {t(
                          "Collect your order in person from our store:",
                          "استلم طلبك شخصيًا من متجرنا:"
                        )}
                      </p>
                      <p className="mb-1">
                        {(isArabic ? storeInfo.store_name_ar : storeInfo.store_name_en) ||
                          "Hala Dresses"}{" "}
                       : {storeInfo.store_address || t("Muscat, Oman", "مسقط، عمان")}
                        {storeInfo.store_phone && (
                          <>
                            {" "}
                           : <span dir="ltr">{storeInfo.store_phone}</span>
                          </>
                        )}
                      </p>
                      <p className="font-medium text-green">
                        {t("No delivery fee.", "لا توجد رسوم توصيل.")}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* checkout right */}
              <div className="max-w-[455px] w-full">
                {/* order list box */}
                <div className="bg-white shadow-1 rounded-[10px]">
                  <div className="border-b border-gray-3 py-5 px-4 sm:px-8.5">
                    <h3 className="font-medium text-xl text-dark">
                      {t("Your Order", "طلبك")}
                    </h3>
                  </div>

                  <div className="pt-2.5 pb-8.5 px-4 sm:px-8.5">
                    <div className="flex items-center justify-between py-5 border-b border-gray-3">
                      <h4 className="font-medium text-dark">
                        {t("Product", "المنتج")}
                      </h4>
                      <h4 className="font-medium text-dark text-right">
                        {t("Subtotal", "المجموع الفرعي")}
                      </h4>
                    </div>

                    {cartItems.length === 0 ? (
                      <p className="py-5 text-dark-4">
                        {t("Your cart is empty.", "سلة التسوق فارغة.")}
                      </p>
                    ) : (
                      cartItems.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between py-5 border-b border-gray-3 gap-3"
                        >
                          <p className="text-dark">
                            {item.title}{" "}
                            <span className="text-dark-4">x{item.quantity}</span>
                            {formatVariantLabel(item) && (
                              <span className="block text-custom-xs text-dark-4 mt-0.5">
                                {formatVariantLabel(item)}
                              </span>
                            )}
                          </p>
                          <p className="text-dark text-right whitespace-nowrap">
                            {(item.discountedPrice * item.quantity).toFixed(3)}{" "}
                            {currency}
                          </p>
                        </div>
                      ))
                    )}

                    {quote?.appliedPromotions.map((p) => (
                      <div key={p.id} className="flex items-center justify-between py-4 border-b border-gray-3 gap-3">
                        <p className="text-green">{t(p.nameEn, p.nameAr)}</p>
                        <p className="text-green text-right whitespace-nowrap">
                          -{p.discount.toFixed(3)} {currency}
                        </p>
                      </div>
                    ))}
                    {quote?.hints.slice(0, 2).map((h) => (
                      <p key={h.promotionId} className="mt-3 rounded-md bg-yellow-light-4 text-dark px-3 py-2 text-custom-sm">
                        {t(h.messageEn, h.messageAr)}
                      </p>
                    ))}

                    <div className="flex items-center justify-between py-5 border-b border-gray-3">
                      <p className="text-dark">{t("Shipping Fee", "رسوم الشحن")}</p>
                      <p className="text-dark text-right">
                        {shownShipping === 0
                          ? t("Free", "مجاني")
                          : `${shownShipping.toFixed(3)} ${currency}`}
                      </p>
                    </div>

                    {showVat && (
                      <div className="flex items-center justify-between py-4 border-b border-gray-3">
                        <p className="text-dark">
                          {quote!.pricesIncludeTax ? t("Includes VAT", "شامل ضريبة القيمة المضافة") : t("VAT", "ضريبة القيمة المضافة")}
                        </p>
                        <p className="text-dark text-right">
                          {quote!.pricesIncludeTax ? "" : "+"}
                          {quote!.taxTotal.toFixed(3)} {currency}
                        </p>
                      </div>
                    )}
                    {quoteError && <p className="mt-3 text-red text-custom-sm">{quoteError}</p>}

                    <div className="flex items-center justify-between pt-5">
                      <p className="font-medium text-lg text-dark">
                        {t("Total", "الإجمالي")}
                      </p>
                      <p className="font-medium text-lg text-dark text-right">
                        {total.toFixed(3)} {currency}
                      </p>
                    </div>
                  </div>
                </div>

                {/* coupon box */}
                <div className="bg-white shadow-1 rounded-[10px] mt-7.5 p-4 sm:p-8.5">
                  <label
                    htmlFor="couponCode"
                    className="block mb-2.5 font-medium text-dark"
                  >
                    {t("Have a coupon code?", "هل لديك كود خصم؟")}
                  </label>
                  <input
                    type="text"
                    name="couponCode"
                    id="couponCode"
                    value={form.couponCode}
                    onChange={handleChange}
                    placeholder={t("Enter coupon code", "أدخل كود الخصم")}
                    className={inputClass}
                  />
                </div>

                {/* payment box */}
                <div className="bg-white shadow-1 rounded-[10px] mt-7.5">
                  <div className="border-b border-gray-3 py-5 px-4 sm:px-8.5">
                    <h3 className="font-medium text-xl text-dark">
                      {t("Payment Method", "طريقة الدفع")}
                    </h3>
                  </div>
                  <div className="p-4 sm:p-8.5 flex flex-col gap-3">
                    {(
                      [
                        [
                          "THAWANI",
                          t("Pay with Card (Thawani)", "الدفع بالبطاقة (ثواني)"),
                          t("Recommended", "موصى به"),
                        ],
                        [
                          "CASH_ON_DELIVERY",
                          t("Cash on delivery", "الدفع عند الاستلام"),
                          null,
                        ],
                        [
                          "BANK_TRANSFER",
                          t("Direct bank transfer", "تحويل بنكي مباشر"),
                          null,
                        ],
                      ] as [PaymentMethod, string, string | null][]
                    ).map(([value, label, badge]) => (
                      <label
                        key={value}
                        className="flex cursor-pointer select-none items-center gap-4"
                      >
                        <input
                          type="radio"
                          name="paymentMethod"
                          value={value}
                          checked={paymentMethod === value}
                          onChange={() => setPaymentMethod(value)}
                          className="sr-only"
                        />
                        <span
                          className={`flex h-4 w-4 items-center justify-center rounded-full flex-shrink-0 ${
                            paymentMethod === value
                              ? "border-4 border-blue"
                              : "border border-gray-4"
                          }`}
                        />
                        <span
                          className={`flex items-center justify-between gap-3 rounded-md border-[0.5px] py-3.5 px-5 w-full ease-out duration-200 ${
                            paymentMethod === value
                              ? "border-transparent bg-gray-2"
                              : "border-gray-4 shadow-1"
                          }`}
                        >
                          {label}
                          {badge && (
                            <span className="text-2xs font-medium text-blue bg-blue-light-5 rounded-full px-2.5 py-0.5">
                              {badge}
                            </span>
                          )}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {error && (
                  <p className="mt-5 text-red text-sm bg-red-light-6 border border-red-light-4 rounded-md py-3 px-4">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={submitting || cartItems.length === 0}
                  className="w-full flex justify-center font-medium text-white bg-blue py-3 px-6 rounded-md ease-out duration-200 hover:bg-blue-dark mt-7.5 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {submitting
                    ? t("Placing order...", "جارٍ إتمام الطلب...")
                    : t("Place Order", "تأكيد الطلب")}
                </button>
              </div>
            </div>
          </form>
        </div>
      </section>
    </>
  );
};

export default Checkout;
