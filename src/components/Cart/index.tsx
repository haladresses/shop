"use client";
import React from "react";
import Link from "next/link";
import { useSelector } from "react-redux";
import { useAppSelector } from "@/redux/store";
import { selectTotalPrice } from "@/redux/features/cart-slice";
import { useLanguage } from "@/app/context/LanguageContext";
import Breadcrumb from "../Common/Breadcrumb";
import CartLine from "../Common/CartSidebarModal/SingleItem";
import EmptyCart from "../Common/CartSidebarModal/EmptyCart";

/** Full-page cart: the same lines as the cart drawer plus a short summary. */
const Cart = () => {
  const { isArabic } = useLanguage();
  const t = (en: string, ar: string) => (isArabic ? ar : en);
  const cartItems = useAppSelector((state) => state.cartReducer.items);
  const totalPrice = useSelector(selectTotalPrice);

  return (
    <>
      <Breadcrumb title={t("Cart", "سلة التسوق")} pages={[t("Cart", "سلة التسوق")]} />
      <section className="overflow-hidden py-14 sm:py-20 bg-meta">
        <div className="max-w-[1170px] w-full mx-auto px-4 sm:px-8 xl:px-0">
          {cartItems.length === 0 ? (
            <div className="max-w-[560px] mx-auto bg-white rounded-xl shadow-1 px-4 py-12 sm:py-16">
              <EmptyCart />
            </div>
          ) : (
            <div className="flex flex-col lg:flex-row lg:items-start gap-7.5 xl:gap-11">
              <div className="w-full bg-white rounded-xl shadow-1 p-4 sm:p-7.5">
                <div className="flex flex-col gap-6">
                  {cartItems.map((item) => (
                    <CartLine key={item.id} item={item} />
                  ))}
                </div>
              </div>

              <div className="w-full lg:max-w-[380px] bg-white rounded-xl shadow-1 p-4 sm:p-7.5">
                <h2 className="font-semibold text-dark text-xl mb-5">{t("Order Summary", "ملخص الطلب")}</h2>
                <div className="flex items-center justify-between gap-4 py-4 border-y border-gray-3">
                  <p className="text-dark">{t("Subtotal", "المجموع الفرعي")}</p>
                  <p className="font-semibold text-dark tabular-nums">
                    {totalPrice.toFixed(3)} {t("OMR", "ر.ع.")}
                  </p>
                </div>
                <p className="mt-3 text-custom-sm text-dark-4">
                  {t("Delivery and coupon codes are added at checkout.", "تُضاف رسوم التوصيل وأكواد الخصم عند إتمام الطلب.")}
                </p>
                <Link
                  href="/checkout"
                  className="mt-6 w-full flex justify-center font-semibold text-white bg-dark py-3 px-6 rounded-full ease-out duration-200 hover:bg-blue"
                >
                  {t("Checkout", "إتمام الطلب")}
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  );
};

export default Cart;
