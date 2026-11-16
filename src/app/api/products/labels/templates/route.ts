import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { ok, error, serverError } from "@/lib/api/response";
import { guard } from "@/lib/api/guard";
import { LABEL_TEMPLATES_KEY, labelTemplatesSchema } from "@/lib/labels";

/** The shop's own barcode-sticker templates, shared by every staff member and device. */
export async function GET(req: NextRequest) {
  try {
    const g = await guard(req, ["admin.products.view", "admin.inventory.view", "admin.suppliers.view"]);
    if ("res" in g) return g.res;
    const row = await prisma.setting.findUnique({ where: { key: LABEL_TEMPLATES_KEY } });
    let data: unknown = { templates: [], defaultId: null };
    try {
      if (row) data = JSON.parse(row.value);
    } catch {
      /* corrupt row — start fresh */
    }
    const parsed = labelTemplatesSchema.safeParse(data);
    return ok(parsed.success ? parsed.data : { templates: [], defaultId: null });
  } catch (e) {
    return serverError(e);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const g = await guard(req, "admin.products.manage");
    if ("res" in g) return g.res;
    const parsed = labelTemplatesSchema.safeParse(await req.json());
    if (!parsed.success) return error(parsed.error.issues[0].message);
    const value = JSON.stringify(parsed.data);
    await prisma.setting.upsert({
      where: { key: LABEL_TEMPLATES_KEY },
      update: { value, type: "json", group: "labels" },
      create: { key: LABEL_TEMPLATES_KEY, value, type: "json", group: "labels", labelEn: "Barcode label templates", labelAr: "قوالب ملصقات الباركود" },
    });
    return ok(parsed.data);
  } catch (e) {
    return serverError(e);
  }
}
