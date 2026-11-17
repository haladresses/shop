"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import Breadcrumb from "../Common/Breadcrumb";
import { useLanguage } from "@/app/context/LanguageContext";

/** Shown after an order is placed with cash on delivery or bank transfer. */
const MailSuccess = () => {
  const { isArabic } = useLanguage();
  const t = (en: string, ar: string) => (isArabic ? ar : en);
  const [orderNumber, setOrderNumber] = useState("");

  useEffect(() => {
    setOrderNumber(new URLSearchParams(window.location.search).get("order") || "");
  }, []);

  return (
    <>
      <Breadcrumb title={t("Order Placed", "تم الطلب")} pages={[t("Order Placed", "تم الطلب")]} />
      <section className="overflow-hidden py-14 sm:py-20 bg-meta">
        <div className="max-w-[1170px] w-full mx-auto px-4 sm:px-8 xl:px-0">
          <div className="bg-white rounded-xl shadow-1 px-4 py-10 sm:py-15 lg:py-20">
            <div className="text-center max-w-[520px] mx-auto">
              <h2 className="font-semibold text-dark text-2xl sm:text-3xl mb-3">
                {t("Thank you for your order", "شكراً لطلبكِ")}
              </h2>

              {orderNumber && (
                <p className="text-dark mb-3">
                  {t("Order number", "رقم الطلب")}:{" "}
                  <span className="font-semibold" dir="ltr">
                    {orderNumber}
                  </span>
                </p>
              )}

              <p className="text-dark-4 mb-7.5">
                {t(
                  "We have received your order and will contact you soon to confirm delivery.",
                  "استلمنا طلبكِ وسنتواصل معكِ قريباً لتأكيد التوصيل."
                )}
              </p>

              <Link
                href="/shop"
                className="inline-flex items-center font-medium text-white bg-dark py-3 px-7 rounded-full ease-out duration-200 hover:bg-blue"
              >
                {t("Continue Shopping", "متابعة التسوق")}
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default MailSuccess;
