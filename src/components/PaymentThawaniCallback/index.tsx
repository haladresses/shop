"use client";
import React, { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Breadcrumb from "../Common/Breadcrumb";
import { useLanguage } from "@/app/context/LanguageContext";

type VerifyResult = {
  orderNumber: string;
  status: string;
  paymentStatus: "PAID" | "UNPAID";
  total: number;
};

function CallbackView() {
  const searchParams = useSearchParams();
  const { isArabic } = useLanguage();
  const t = (en: string, ar: string) => (isArabic ? ar : en);

  const orderId = searchParams.get("orderId") || "";
  const cancelled = searchParams.get("cancelled") === "1";

  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [error, setError] = useState("");

  const verify = useCallback(async () => {
    if (!orderId) {
      setError(t("Missing order reference.", "مرجع الطلب مفقود."));
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/payments/thawani/verify?orderId=${orderId}`);
      const data = await res.json();
      if (!data.success) {
        setError(data.error || t("Could not verify the payment.", "تعذر التحقق من الدفع."));
      } else {
        setResult(data.data);
      }
    } catch {
      setError(t("Something went wrong. Please try again.", "حدث خطأ ما. حاول مرة أخرى."));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  useEffect(() => {
    verify();
  }, [verify]);

  const retryPayment = async () => {
    setRetrying(true);
    setError("");
    try {
      const res = await fetch("/api/payments/thawani/create-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || t("Could not start a new payment.", "تعذر بدء عملية دفع جديدة."));
        setRetrying(false);
        return;
      }
      window.location.href = data.data.redirectUrl;
    } catch {
      setError(t("Something went wrong. Please try again.", "حدث خطأ ما. حاول مرة أخرى."));
      setRetrying(false);
    }
  };

  const isPaid = result?.paymentStatus === "PAID";

  return (
    <section className="overflow-hidden py-20 bg-gray-2">
      <div className="max-w-[1170px] w-full mx-auto px-4 sm:px-8 xl:px-0">
        <div className="bg-white rounded-xl shadow-1 px-4 py-10 sm:py-15 lg:py-20 xl:py-25">
          <div className="text-center max-w-[520px] mx-auto">
            {loading ? (
              <p className="text-dark-4">{t("Checking your payment...", "جارٍ التحقق من الدفع...")}</p>
            ) : isPaid ? (
              <>
                <h2 className="font-bold text-blue text-4xl lg:text-[45px] lg:leading-[57px] mb-5">
                  {t("Payment Successful!", "تم الدفع بنجاح!")}
                </h2>
                <p className="mb-7.5">
                  {t("Order", "الطلب")} <span className="font-medium">{result?.orderNumber}</span>{" "}
                  {t("has been paid.", "تم دفعه.")}
                </p>
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 font-medium text-white bg-blue py-3 px-6 rounded-md ease-out duration-200 hover:bg-blue-dark"
                >
                  {t("Back to Home", "العودة للرئيسية")}
                </Link>
              </>
            ) : (
              <>
                <h2 className="font-bold text-red text-3xl lg:text-4xl mb-5">
                  {cancelled
                    ? t("Payment Cancelled", "تم إلغاء الدفع")
                    : t("Payment Not Completed", "لم تكتمل عملية الدفع")}
                </h2>
                <p className="mb-7.5 text-dark-4">
                  {result &&
                    `${t("Order", "الطلب")} ${result.orderNumber} — ${t("total", "الإجمالي")} ${Number(
                      result.total
                    ).toFixed(3)} OMR`}
                </p>
                {error && (
                  <p className="mb-5 text-red text-sm bg-red-light-6 border border-red-light-4 rounded-md py-3 px-4">
                    {error}
                  </p>
                )}
                <div className="flex items-center justify-center gap-4 flex-wrap">
                  <button
                    onClick={retryPayment}
                    disabled={retrying || !orderId}
                    className="inline-flex items-center gap-2 font-medium text-white bg-blue py-3 px-6 rounded-md ease-out duration-200 hover:bg-blue-dark disabled:opacity-60"
                  >
                    {retrying ? t("Redirecting...", "جارٍ التحويل...") : t("Retry Payment", "إعادة محاولة الدفع")}
                  </button>
                  <Link
                    href="/"
                    className="inline-flex items-center gap-2 font-medium text-dark bg-gray-1 py-3 px-6 rounded-md ease-out duration-200 hover:bg-gray-2 border border-gray-3"
                  >
                    {t("Continue Shopping", "متابعة التسوق")}
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

const PaymentThawaniCallback = () => {
  const { isArabic } = useLanguage();
  return (
    <>
      <Breadcrumb title={isArabic ? "حالة الدفع" : "Payment Status"} pages={["payment"]} />
      <Suspense fallback={<div className="py-20 text-center text-dark-4">...</div>}>
        <CallbackView />
      </Suspense>
    </>
  );
};

export default PaymentThawaniCallback;
