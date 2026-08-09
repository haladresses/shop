import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { getAuthFromRequest, userHasPermission } from "@/lib/auth";
import { ok, error, unauthorized, forbidden, serverError } from "@/lib/api/response";

/** Settings keys the Contact admin screen is allowed to read and write. */
export const CONTACT_INFO_FIELDS = [
  { key: "store_name_en", labelEn: "Store Name (EN)", labelAr: "اسم المتجر (إنجليزي)" },
  { key: "store_name_ar", labelEn: "Store Name (AR)", labelAr: "اسم المتجر (عربي)" },
  { key: "store_email", labelEn: "Store Email", labelAr: "البريد الإلكتروني" },
  { key: "store_phone", labelEn: "Phone", labelAr: "الهاتف" },
  { key: "store_whatsapp", labelEn: "WhatsApp", labelAr: "واتساب" },
  { key: "store_address", labelEn: "Address", labelAr: "العنوان" },
  { key: "store_instagram", labelEn: "Instagram", labelAr: "انستغرام" },
  { key: "store_map_url", labelEn: "Map URL", labelAr: "رابط الخريطة" },
] as const;

const KEYS = CONTACT_INFO_FIELDS.map((f) => f.key);

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthFromRequest(req);
    if (!user) return unauthorized();
    if (!(await userHasPermission(user, "admin.contact.view"))) return forbidden();

    const rows = await prisma.setting.findMany({ where: { key: { in: [...KEYS] } } });
    const map = KEYS.reduce(
      (acc, key) => {
        acc[key] = rows.find((r) => r.key === key)?.value ?? "";
        return acc;
      },
      {} as Record<string, string>,
    );

    return ok(map);
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthFromRequest(req);
    if (!user) return unauthorized();
    if (!(await userHasPermission(user, "admin.contact.manage"))) return forbidden();

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return error("Invalid request body");

    const updates = CONTACT_INFO_FIELDS.filter((field) => field.key in (body as Record<string, unknown>)).map(
      (field) => {
        const raw = (body as Record<string, unknown>)[field.key];
        const value = typeof raw === "string" ? raw.trim().slice(0, 500) : "";
        return prisma.setting.upsert({
          where: { key: field.key },
          update: { value, type: "string", group: "general" },
          create: {
            key: field.key,
            value,
            type: "string",
            group: "general",
            labelEn: field.labelEn,
            labelAr: field.labelAr,
          },
        });
      },
    );

    await Promise.all(updates);

    const rows = await prisma.setting.findMany({ where: { key: { in: [...KEYS] } } });
    const map = KEYS.reduce(
      (acc, key) => {
        acc[key] = rows.find((r) => r.key === key)?.value ?? "";
        return acc;
      },
      {} as Record<string, string>,
    );

    return ok(map);
  } catch (e) {
    return serverError(e);
  }
}
