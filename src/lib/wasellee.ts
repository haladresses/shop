import prisma from "@/lib/db";
import type { WaselleeBranch, WaselleeDeliveryType } from "@prisma/client";

type ShippingAddress = {
  nameEn?: string;
  phone?: string;
  city?: string;
  area?: string;
  street?: string;
  buildingNo?: string;
  country?: string;
};

type OrderForNotify = {
  orderNumber: string;
  guestName: string | null;
  notes: string | null;
  total: unknown;
  shippingAddress: unknown;
  waselleeDeliveryType: WaselleeDeliveryType | null;
};

export function calculateWaselleeCost(
  branch: Pick<WaselleeBranch, "homeDeliveryCost" | "officePickupCost">,
  deliveryType: WaselleeDeliveryType
): number {
  return deliveryType === "OFFICE_PICKUP"
    ? Number(branch.officePickupCost)
    : Number(branch.homeDeliveryCost);
}

function formatAddress(addr: ShippingAddress): string {
  return [addr.buildingNo, addr.street, addr.area, addr.city].filter(Boolean).join(", ");
}

export function buildWaselleeWhatsAppMessage(
  order: OrderForNotify,
  branch: Pick<WaselleeBranch, "cityEn">,
  paymentMethod: string
): string {
  const addr = (order.shippingAddress as ShippingAddress) || {};
  const deliveryLabel =
    order.waselleeDeliveryType === "OFFICE_PICKUP"
      ? `تحویل از فرع (${branch.cityEn})`
      : "توصیل درب المنزل";

  const lines = [
    "سلام،",
    "",
    "یک سفارش جدید برای ارسال از طریق وصلی ثبت شده است.",
    "",
    `شماره سفارش: ${order.orderNumber}`,
    `نام مشتری: ${addr.nameEn || order.guestName || "-"}`,
    `شماره تماس مشتری: ${addr.phone || "-"}`,
    `شهر: ${addr.city || branch.cityEn}`,
    `آدرس کامل: ${formatAddress(addr) || "-"}`,
    `روش تحویل: ${deliveryLabel}`,
    `مبلغ سفارش: ${Number(order.total).toFixed(3)} OMR`,
    `روش پرداخت: ${paymentMethod}`,
    ...(paymentMethod === "CASH_ON_DELIVERY"
      ? [`مبلغ قابل دریافت از مشتری هنگام تحویل: ${Number(order.total).toFixed(3)} OMR`]
      : []),
    ...(order.notes ? [`توضیحات: ${order.notes}`] : []),
    "",
    "لطفاً هزینه ارسال، زمان دریافت بسته و اطلاعات راننده را تأیید کنید.",
  ];

  return lines.join("\n");
}

function digitsOnly(v: string) {
  return v.replace(/[^0-9]/g, "");
}

/** Normalise any local/international number to wa.me digits (Oman default). */
export function toWhatsAppNumber(raw: string): string {
  const digits = digitsOnly(raw);
  if (!digits) return "";
  if (digits.startsWith("968")) return digits;
  // Local Omani numbers are 8 digits; prefix the country code.
  if (digits.length === 8) return `968${digits}`;
  return digits;
}

/** Builds a click-to-chat WhatsApp Web link (opens in the user's WhatsApp). */
export function buildWhatsAppLink(phone: string, text: string): string {
  const number = toWhatsAppNumber(phone);
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

type OrderForDispatch = {
  orderNumber: string;
  guestName: string | null;
  notes: string | null;
  total: unknown;
  shippingAddress: unknown;
  itemsCount?: number;
  paymentMethod?: string;
};

const isCod = (m?: string) => (m || "").toUpperCase().includes("CASH");

/**
 * Prepared Arabic message handed to the delivery DRIVER (راننده) once the
 * order is packed and ready for pickup.
 */
export function buildDriverDispatchMessage(order: OrderForDispatch): string {
  const addr = (order.shippingAddress as ShippingAddress) || {};
  const lines = [
    "مرحباً 👋",
    "الطلب جاهز للاستلام والتوصيل.",
    "",
    `رقم الطلب: ${order.orderNumber}`,
    `اسم العميل: ${addr.nameEn || order.guestName || "-"}`,
    `هاتف العميل: ${addr.phone || "-"}`,
    `العنوان: ${formatAddress(addr) || "-"}`,
    ...(order.itemsCount ? [`عدد القطع: ${order.itemsCount}`] : []),
    `الإجمالي: ${Number(order.total).toFixed(3)} ر.ع`,
    ...(isCod(order.paymentMethod)
      ? [`💵 يُحصّل من العميل عند التسليم: ${Number(order.total).toFixed(3)} ر.ع`]
      : ["✅ مدفوع مسبقاً"]),
    ...(order.notes ? [`ملاحظات: ${order.notes}`] : []),
    "",
    "يرجى تأكيد الاستلام ووقت التوصيل. شكراً 🌸",
  ];
  return lines.join("\n");
}

/**
 * Prepared Arabic message handed to WASLI / وصلي (the delivery company office)
 * — works for any order, with or without a resolved Wasellee branch.
 */
export function buildWasliDispatchMessage(
  order: OrderForDispatch,
  branchCity?: string | null
): string {
  const addr = (order.shippingAddress as ShippingAddress) || {};
  const lines = [
    "سلام وصلي 👋",
    "طلب جديد جاهز للشحن.",
    "",
    `رقم الطلب: ${order.orderNumber}`,
    `اسم العميل: ${addr.nameEn || order.guestName || "-"}`,
    `هاتف العميل: ${addr.phone || "-"}`,
    `المدينة: ${addr.city || branchCity || "-"}`,
    `العنوان الكامل: ${formatAddress(addr) || "-"}`,
    `مبلغ الطلب: ${Number(order.total).toFixed(3)} ر.ع`,
    ...(isCod(order.paymentMethod)
      ? [`💵 الدفع عند الاستلام: ${Number(order.total).toFixed(3)} ر.ع`]
      : ["✅ مدفوع مسبقاً"]),
    ...(order.notes ? [`ملاحظات: ${order.notes}`] : []),
    "",
    "يرجى تأكيد التكلفة ووقت الاستلام. شكراً 🌸",
  ];
  return lines.join("\n");
}

/** Resolves the plain phone strings for the two dispatch channels. */
export async function getDispatchPhones() {
  const settings = await getWaselleeSettings();
  const driver = settings.bousherDriverPhone || settings.bousherContactPhone || "";
  const wasli = settings.notifyChatId
    ? settings.notifyChatId.replace("@c.us", "")
    : settings.bousherOfficePhone;
  return { driver, wasli };
}

/** Reads the singleton config row, lazily creating a default one on first use. */
export async function getWaselleeSettings() {
  const existing = await prisma.waselleeSettings.findFirst();
  if (existing) return existing;
  return prisma.waselleeSettings.create({ data: {} });
}

function resolveChatId(settings: { notifyChatId: string | null; bousherOfficePhone: string }) {
  if (settings.notifyChatId) return settings.notifyChatId;
  const digits = digitsOnly(settings.bousherOfficePhone);
  const withCountryCode = digits.startsWith("968") ? digits : `968${digits}`;
  return `${withCountryCode}@c.us`;
}

export async function buildWaselleeManualWhatsAppLink(
  order: OrderForNotify,
  branch: Pick<WaselleeBranch, "cityEn">,
  paymentMethod: string
): Promise<string> {
  const settings = await getWaselleeSettings();
  const chatId = resolveChatId(settings);
  const number = chatId.replace("@c.us", "");
  const text = buildWaselleeWhatsAppMessage(order, branch, paymentMethod);
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

/**
 * Sends the order notification to the Wasellee Bousher office via a
 * self-hosted WAHA (WhatsApp HTTP API) instance — no Meta Business API or
 * pre-approved templates required, since WAHA drives a real WhatsApp Web
 * session. Never throws: checkout must always succeed even if the send fails.
 */
export async function sendWaselleeOrderNotification(
  order: OrderForNotify,
  branch: Pick<WaselleeBranch, "cityEn">,
  paymentMethod: string
): Promise<{ ok: boolean; error?: string }> {
  const settings = await getWaselleeSettings();

  if (!settings.isNotifyEnabled) {
    return { ok: false, error: "Wasellee WhatsApp notifications are disabled in settings" };
  }
  if (!settings.wahaBaseUrl) {
    return { ok: false, error: "WAHA base URL is not configured" };
  }

  const chatId = resolveChatId(settings);
  const text = buildWaselleeWhatsAppMessage(order, branch, paymentMethod);
  const baseUrl = settings.wahaBaseUrl.replace(/\/$/, "");

  try {
    const res = await fetch(`${baseUrl}/api/sendText`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(settings.wahaApiKey ? { "X-Api-Key": settings.wahaApiKey } : {}),
      },
      body: JSON.stringify({
        session: settings.wahaSession || "default",
        chatId,
        text,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `WAHA ${res.status}: ${body.slice(0, 300)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown WAHA send error" };
  }
}
