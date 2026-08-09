"use client";

import React, { useEffect, useState } from "react";
import { FaInstagram, FaWhatsapp } from "react-icons/fa";
import { LuArrowUpRight, LuMapPin, LuPhone, LuStore } from "react-icons/lu";
import Breadcrumb from "../Common/Breadcrumb";
import { useLanguage } from "@/app/context/LanguageContext";

type StoreInfo = {
  nameEn: string;
  nameAr: string;
  phone: string;
  whatsapp: string;
  address: string;
  instagram: string;
  mapUrl: string;
};

const DEFAULT_STORE_INFO: StoreInfo = {
  nameEn: "Hala Dresses Retail Team",
  nameAr: "فريق هلا دريسز",
  phone: "+968 9944 0312",
  whatsapp: "",
  address: "Bousher, Muscat, Oman",
  instagram: "7ala_dresses",
  mapUrl: "",
};

/** Normalize an Instagram value (handle, @handle, or full URL) to a bare username. */
function instagramUsername(raw: string): string {
  return raw
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/^instagram\.com\//i, "")
    .replace(/^@/, "")
    .replace(/\/+$/, "");
}

const Contact = () => {
  const { isArabic } = useLanguage();
  const [store, setStore] = useState<StoreInfo>(DEFAULT_STORE_INFO);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/settings?group=general", { signal: controller.signal })
      .then((r) => r.json())
      .then((d) => {
        if (!d.success) return;
        const map = d.data as Record<string, unknown>;
        setStore({
          nameEn: String(map.store_name_en ?? DEFAULT_STORE_INFO.nameEn),
          nameAr: String(map.store_name_ar ?? DEFAULT_STORE_INFO.nameAr),
          phone: String(map.store_phone ?? DEFAULT_STORE_INFO.phone),
          whatsapp: String(map.store_whatsapp ?? DEFAULT_STORE_INFO.whatsapp),
          address: String(map.store_address ?? DEFAULT_STORE_INFO.address),
          instagram: String(map.store_instagram ?? DEFAULT_STORE_INFO.instagram),
          mapUrl: String(map.store_map_url ?? DEFAULT_STORE_INFO.mapUrl),
        });
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  const supportPhone = store.phone;
  const telHref = `tel:${store.phone.replace(/\s+/g, "")}`;
  const whatsappDigits = (store.whatsapp || store.phone).replace(/[^\d]/g, "");
  const whatsappHref = `https://wa.me/${whatsappDigits}`;
  const igUser = instagramUsername(store.instagram);
  const instagramHref = `https://instagram.com/${igUser}`;
  const mapHref = store.mapUrl.trim()
    ? store.mapUrl.trim()
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(store.address)}`;

  const [form, setForm] = useState({ firstName: "", lastName: "", subject: "", phone: "", message: "" });
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [feedback, setFeedback] = useState("");

  const copy = isArabic
    ? {
        breadcrumbTitle: "اتصل بنا",
        breadcrumbPage: "اتصل بنا",
        heading: "تواصلي مع هلا دريسز",
        subheading: "فريقنا في مسقط جاهز لمساعدتك في الطلبات والمقاسات والتوصيل.",
        nameLabel: "المتجر",
        nameValue: store.nameAr,
        callLabel: "اتصلي بنا",
        whatsappLabel: "واتساب",
        whatsappValue: "تواصل سريع عبر الواتساب",
        instagramLabel: "انستغرام",
        addressLabel: "الموقع",
        mapHint: "عرض على الخريطة",
        firstName: "الاسم الأول",
        firstNamePlaceholder: "اكتبي اسمك الأول",
        lastName: "اسم العائلة",
        lastNamePlaceholder: "اكتبي اسم العائلة",
        subject: "الموضوع",
        subjectPlaceholder: "قسم النساء / قسم الأطفال / مساعدة في الطلب",
        phoneLabel: "الهاتف",
        phonePlaceholder: "شاركي رقم الهاتف أو الواتساب",
        message: "الرسالة",
        messagePlaceholder: "أخبرينا ماذا تبحثين عنه ولمن سيكون",
        submit: "إرسال إلى فريق المتجر",
        sending: "جارٍ الإرسال...",
        successMsg: "تم استلام رسالتك، سيتواصل معك فريقنا قريباً.",
        errorMsg: "تعذر إرسال الرسالة، يرجى المحاولة مرة أخرى.",
        requiredMsg: "يرجى إدخال الاسم والرسالة.",
      }
    : {
        breadcrumbTitle: "Contact",
        breadcrumbPage: "contact",
        heading: "Contact Hala Dresses",
        subheading: "Our Muscat team is ready to help with orders, sizing, and delivery.",
        nameLabel: "Store",
        nameValue: store.nameEn,
        callLabel: "Call us",
        whatsappLabel: "WhatsApp",
        whatsappValue: "Chat with us instantly",
        instagramLabel: "Instagram",
        addressLabel: "Location",
        mapHint: "View on map",
        firstName: "First Name",
        firstNamePlaceholder: "Your first name",
        lastName: "Last Name",
        lastNamePlaceholder: "Your last name",
        subject: "Subject",
        subjectPlaceholder: "Women collection / kids collection / order help",
        phoneLabel: "Phone",
        phonePlaceholder: "Share your phone or WhatsApp number",
        message: "Message",
        messagePlaceholder: "Tell us what you are shopping for and who it is for",
        submit: "Send to Store Team",
        sending: "Sending...",
        successMsg: "Thanks! Your message has reached our team — we'll be in touch soon.",
        errorMsg: "We couldn't send your message. Please try again.",
        requiredMsg: "Please enter your name and a message.",
      };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.firstName.trim() || !form.message.trim()) {
      setStatus("error");
      setFeedback(copy.requiredMsg);
      return;
    }
    setStatus("sending");
    setFeedback("");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, language: isArabic ? "ar" : "en" }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "failed");
      setStatus("success");
      setFeedback(copy.successMsg);
      setForm({ firstName: "", lastName: "", subject: "", phone: "", message: "" });
    } catch (err) {
      setStatus("error");
      setFeedback(err instanceof Error && err.message !== "failed" ? err.message : copy.errorMsg);
    }
  };

  const iconWrap = "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full";
  const rowLink =
    "group flex items-center gap-4 rounded-xl px-2.5 py-2.5 transition-colors duration-200 hover:bg-gray-1";
  const rowLabel = "text-xs text-dark-4";
  const rowValue = "font-medium text-dark";
  const rowArrow =
    "ms-auto shrink-0 text-dark-5 transition-all duration-200 opacity-0 -translate-x-1 group-hover:translate-x-0 group-hover:opacity-100";

  return (
    <>
      <Breadcrumb title={copy.breadcrumbTitle} pages={[copy.breadcrumbPage]} />

      <section className="overflow-hidden py-20 bg-gray-2">
        <div className="max-w-[1170px] w-full mx-auto px-4 sm:px-8 xl:px-0">
          <div className={`flex flex-col xl:flex-row gap-7.5 ${isArabic ? "text-right" : ""}`}>
            <div className="xl:max-w-[370px] w-full bg-white rounded-xl shadow-1">
              <div className="py-5 px-4 sm:px-7.5 border-b border-gray-3">
                <p className="font-medium text-xl text-dark">{copy.heading}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-dark-4">{copy.subheading}</p>
              </div>

              <div className="p-4 sm:p-7.5">
                <div className="flex flex-col gap-1.5">
                  {/* Store */}
                  <div className="flex items-center gap-4 px-2.5 py-2.5">
                    <span className={`${iconWrap} bg-blue-light-5 text-blue`}>
                      <LuStore size={20} />
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className={rowLabel}>{copy.nameLabel}</span>
                      <span className={rowValue}>{copy.nameValue}</span>
                    </span>
                  </div>

                  {/* Call */}
                  <a href={telHref} className={rowLink}>
                    <span className={`${iconWrap} bg-blue-light-5 text-blue`}>
                      <LuPhone size={20} />
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className={rowLabel}>{copy.callLabel}</span>
                      <span className={`phone-ltr inline-block ${rowValue}`}>{supportPhone}</span>
                    </span>
                    <LuArrowUpRight size={18} className={rowArrow} />
                  </a>

                  {/* WhatsApp */}
                  <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className={rowLink}>
                    <span className={`${iconWrap} bg-green-50 text-green-600`}>
                      <FaWhatsapp size={20} />
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className={rowLabel}>{copy.whatsappLabel}</span>
                      <span className={rowValue}>{copy.whatsappValue}</span>
                    </span>
                    <LuArrowUpRight size={18} className={rowArrow} />
                  </a>

                  {/* Instagram */}
                  <a href={instagramHref} target="_blank" rel="noopener noreferrer" className={rowLink}>
                    <span className={`${iconWrap} bg-pink-50 text-pink-600`}>
                      <FaInstagram size={20} />
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className={rowLabel}>{copy.instagramLabel}</span>
                      <span className={`phone-ltr inline-block ${rowValue}`}>@{igUser}</span>
                    </span>
                    <LuArrowUpRight size={18} className={rowArrow} />
                  </a>

                  {/* Location */}
                  <a href={mapHref} target="_blank" rel="noopener noreferrer" className={rowLink}>
                    <span className={`${iconWrap} bg-blue-light-5 text-blue`}>
                      <LuMapPin size={20} />
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className={rowLabel}>{copy.addressLabel}</span>
                      <span className={rowValue}>{store.address}</span>
                      <span className="mt-0.5 text-xs font-medium text-blue">{copy.mapHint}</span>
                    </span>
                    <LuArrowUpRight size={18} className={rowArrow} />
                  </a>
                </div>
              </div>
            </div>

            <div className="xl:max-w-[770px] w-full bg-white rounded-xl shadow-1 p-4 sm:p-7.5 xl:p-10">
              <form onSubmit={handleSubmit} noValidate>
                <div className="flex flex-col lg:flex-row gap-5 sm:gap-8 mb-5">
                  <div className="w-full">
                    <label htmlFor="firstName" className="block mb-2.5">
                      {copy.firstName} <span className="text-red">*</span>
                    </label>

                    <input
                      type="text"
                      name="firstName"
                      id="firstName"
                      value={form.firstName}
                      onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                      placeholder={copy.firstNamePlaceholder}
                      className="rounded-md border border-gray-3 bg-gray-1 placeholder:text-dark-5 w-full py-2.5 px-5 outline-none duration-200 focus:border-transparent focus:shadow-input focus:ring-2 focus:ring-blue/20"
                    />
                  </div>

                  <div className="w-full">
                    <label htmlFor="lastName" className="block mb-2.5">
                      {copy.lastName} <span className="text-red">*</span>
                    </label>

                    <input
                      type="text"
                      name="lastName"
                      id="lastName"
                      value={form.lastName}
                      onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                      placeholder={copy.lastNamePlaceholder}
                      className="rounded-md border border-gray-3 bg-gray-1 placeholder:text-dark-5 w-full py-2.5 px-5 outline-none duration-200 focus:border-transparent focus:shadow-input focus:ring-2 focus:ring-blue/20"
                    />
                  </div>
                </div>

                <div className="flex flex-col lg:flex-row gap-5 sm:gap-8 mb-5">
                  <div className="w-full">
                    <label htmlFor="subject" className="block mb-2.5">
                      {copy.subject}
                    </label>

                    <input
                      type="text"
                      name="subject"
                      id="subject"
                      value={form.subject}
                      onChange={(e) => setForm({ ...form, subject: e.target.value })}
                      placeholder={copy.subjectPlaceholder}
                      className="rounded-md border border-gray-3 bg-gray-1 placeholder:text-dark-5 w-full py-2.5 px-5 outline-none duration-200 focus:border-transparent focus:shadow-input focus:ring-2 focus:ring-blue/20"
                    />
                  </div>

                  <div className="w-full">
                    <label htmlFor="phone" className="block mb-2.5">
                      {copy.phoneLabel}
                    </label>

                    <input
                      type="text"
                      name="phone"
                      id="phone"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      placeholder={copy.phonePlaceholder}
                      className="rounded-md border border-gray-3 bg-gray-1 placeholder:text-dark-5 w-full py-2.5 px-5 outline-none duration-200 focus:border-transparent focus:shadow-input focus:ring-2 focus:ring-blue/20"
                    />
                  </div>
                </div>

                <div className="mb-7.5">
                  <label htmlFor="message" className="block mb-2.5">
                    {copy.message}
                  </label>

                  <textarea
                    name="message"
                    id="message"
                    rows={5}
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    placeholder={copy.messagePlaceholder}
                    className="rounded-md border border-gray-3 bg-gray-1 placeholder:text-dark-5 w-full p-5 outline-none duration-200 focus:border-transparent focus:shadow-input focus:ring-2 focus:ring-blue/20"
                  ></textarea>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                  <button
                    type="submit"
                    disabled={status === "sending"}
                    className="inline-flex font-medium text-white bg-blue py-3 px-7 rounded-md ease-out duration-200 hover:bg-blue-dark disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {status === "sending" ? copy.sending : copy.submit}
                  </button>
                  {feedback ? (
                    <p
                      role="status"
                      className={`text-sm font-medium ${status === "success" ? "text-green-600" : "text-red"}`}
                    >
                      {feedback}
                    </p>
                  ) : null}
                </div>
              </form>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default Contact;
