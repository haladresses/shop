import { NextRequest } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db";
import { ok, error, serverError } from "@/lib/api/response";
import { guard } from "@/lib/api/guard";

// Each staff member's own Dashboard shortcuts (pages they starred).
// Stored as one settings row per person in the private "user-prefs" group.

const keyFor = (userId: string) => `admin_shortcuts:${userId}`;

const shortcutsSchema = z
  .array(
    z.object({
      href: z
        .string()
        .trim()
        .max(300)
        .refine((h) => h.startsWith("/admin") || h.startsWith("/pos"), "Only admin pages can be added"),
      label: z.string().trim().min(1).max(80),
    }),
  )
  .max(24, "You can keep up to 24 shortcuts");

export async function GET(req: NextRequest) {
  try {
    const g = await guard(req, "panel.admin.access");
    if ("res" in g) return g.res;
    const row = await prisma.setting.findUnique({ where: { key: keyFor(g.user.id) } });
    let list: unknown = [];
    try {
      list = row ? JSON.parse(row.value) : [];
    } catch {
      list = [];
    }
    const parsed = shortcutsSchema.safeParse(list);
    return ok(parsed.success ? parsed.data : []);
  } catch (e) {
    return serverError(e);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const g = await guard(req, "panel.admin.access");
    if ("res" in g) return g.res;
    const parsed = shortcutsSchema.safeParse(await req.json());
    if (!parsed.success) return error(parsed.error.issues[0].message);
    // One entry per page.
    const seen = new Set<string>();
    const list = parsed.data.filter((s) => !seen.has(s.href) && seen.add(s.href));
    const value = JSON.stringify(list);
    await prisma.setting.upsert({
      where: { key: keyFor(g.user.id) },
      update: { value, type: "json", group: "user-prefs" },
      create: { key: keyFor(g.user.id), value, type: "json", group: "user-prefs", labelEn: "Dashboard shortcuts" },
    });
    return ok(list);
  } catch (e) {
    return serverError(e);
  }
}
