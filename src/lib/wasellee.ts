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
