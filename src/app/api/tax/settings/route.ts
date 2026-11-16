import { NextRequest } from "next/server";
import { ok, error, serverError } from "@/lib/api/response";
import { guard } from "@/lib/api/guard";
import { getDefaultTaxRate, getTaxSettings, saveTaxSettings, taxSettingsSchema } from "@/lib/tax";

/**
 * VAT settings. Public on purpose: the VAT number and whether prices include
 * VAT are printed on every invoice and needed by the storefront/POS to show
 * totals — nothing here is secret.
 */
export async function GET() {
  try {
    const [settings, defaultRate] = await Promise.all([getTaxSettings(), getDefaultTaxRate()]);
    return ok({ ...settings, defaultRate });
  } catch (e) {
    return serverError(e);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const g = await guard(req, "admin.tax.manage");
    if ("res" in g) return g.res;
    const parsed = taxSettingsSchema.safeParse(await req.json());
    if (!parsed.success) return error(parsed.error.issues[0].message);
    const saved = await saveTaxSettings({ ...parsed.data, vatNumber: parsed.data.vatNumber ?? "" });
    return ok({ ...saved, defaultRate: await getDefaultTaxRate() });
  } catch (e) {
    return serverError(e);
  }
}
