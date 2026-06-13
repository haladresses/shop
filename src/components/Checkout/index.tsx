"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Breadcrumb from "../Common/Breadcrumb";
import { useAppSelector, AppDispatch } from "@/redux/store";
import { useDispatch } from "react-redux";
import {
  selectTotalPrice,
  removeAllItemsFromCart,
} from "@/redux/features/cart-slice";
import { useLanguage } from "@/app/context/LanguageContext";

type PaymentMethod = "CASH_ON_DELIVERY" | "BANK_TRANSFER" | "CARD";

const FREE_SHIPPING_THRESHOLD = 10;
const SHIPPING_COST = 1.5;

const Checkout = () => {
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const { isArabic } = useLanguage();
  const currency = isArabic ? "ر.ع." : "OMR";
  const t = (en: string, ar: string) => (isArabic ? ar : en);

  const cartItems = useAppSelector((state) => state.cartReducer.items);
  const subtotal = useAppSelector(selectTotalPrice);
  const shippingCost =
    subtotal >= FREE_SHIPPING_THRESHOLD || subtotal === 0 ? 0 : SHIPPING_COST;
  const total = subtotal + shippingCost;

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
    useState<PaymentMethod>("CASH_ON_DELIVERY");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

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

    setSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cartItems.map((item) => ({
            productId: item.id,
            ...(item.variantId ? { variantId: item.variantId } : {}),
            quantity: item.quantity,
          })),
          shippingAddress: {
            nameEn: form.nameEn,
            phone: form.phone,
            city: form.city,
            area: form.area || undefined,
            street: form.street || undefined,
            buildingNo: form.buildingNo || undefined,
            country: "OM",
          },
          couponCode: form.couponCode || undefined,
          notes: form.notes || undefined,
          paymentMethod,
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
      dispatch(removeAllItemsFromCart());
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
                      <span className="text-red">*</span>
                    </label>
                    <input
                      type="email"
                      name="email"
                      id="email"
                      required
                      value={form.email}
                      onChange={handleChange}
                      className={inputClass}
                    />
                  </div>

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
                          className="flex items-center justify-between py-5 border-b border-gray-3"
                        >
                          <p className="text-dark">
                            {item.title}{" "}
                            <span className="text-dark-4">x{item.quantity}</span>
                          </p>
                          <p className="text-dark text-right">
                            {(item.discountedPrice * item.quantity).toFixed(3)}{" "}
                            {currency}
                          </p>
                        </div>
                      ))
                    )}

                    <div className="flex items-center justify-between py-5 border-b border-gray-3">
                      <p className="text-dark">{t("Shipping Fee", "رسوم الشحن")}</p>
                      <p className="text-dark text-right">
                        {shippingCost === 0
                          ? t("Free", "مجاني")
                          : `${shippingCost.toFixed(3)} ${currency}`}
                      </p>
                    </div>

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
                          "CASH_ON_DELIVERY",
                          t("Cash on delivery", "الدفع عند الاستلام"),
                        ],
                        [
                          "BANK_TRANSFER",
                          t("Direct bank transfer", "تحويل بنكي مباشر"),
                        ],
                        ["CARD", t("Credit / Debit card", "بطاقة ائتمان / خصم")],
                      ] as [PaymentMethod, string][]
                    ).map(([value, label]) => (
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
                          className={`flex h-4 w-4 items-center justify-center rounded-full ${
                            paymentMethod === value
                              ? "border-4 border-blue"
                              : "border border-gray-4"
                          }`}
                        />
                        <span
                          className={`rounded-md border-[0.5px] py-3.5 px-5 w-full ease-out duration-200 ${
                            paymentMethod === value
                              ? "border-transparent bg-gray-2"
                              : "border-gray-4 shadow-1"
                          }`}
                        >
                          {label}
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
