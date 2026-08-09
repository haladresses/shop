import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { getAuthFromRequest, userHasPermission } from "@/lib/auth";
import { ok, error, unauthorized, forbidden, serverError } from "@/lib/api/response";
import { DEFAULT_RETENTION } from "@/lib/backup";

const KEYS = [
  "backup_schedule_enabled",
  "backup_schedule_frequency",
  "backup_retention_count",
  "backup_last_run_at",
] as const;

const DEFAULTS: Record<(typeof KEYS)[number], string> = {
  backup_schedule_enabled: "false",
  backup_schedule_frequency: "daily",
  backup_retention_count: String(DEFAULT_RETENTION),
  backup_last_run_at: "",
};

export async function GET(req: NextRequest) {
  try {
    const admin = await getAuthFromRequest(req);
    if (!admin) return unauthorized();
    if (!(await userHasPermission(admin, "admin.backups.schedule"))) return forbidden();

    const rows = await prisma.setting.findMany({ where: { key: { in: [...KEYS] } } });
    const map: Record<string, string> = { ...DEFAULTS };
    rows.forEach((r) => {
      map[r.key] = r.value;
    });
    return ok(map);
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await getAuthFromRequest(req);
    if (!admin) return unauthorized();
    if (!(await userHasPermission(admin, "admin.backups.schedule"))) return forbidden();

    const body = await req.json();
    if (!body || typeof body !== "object") return error("Invalid body");

    const { backup_schedule_enabled, backup_schedule_frequency, backup_retention_count } =
      body as Record<string, unknown>;

    if (
      backup_schedule_frequency !== undefined &&
      !["daily", "weekly"].includes(String(backup_schedule_frequency))
    ) {
      return error("backup_schedule_frequency must be 'daily' or 'weekly'");
    }

    if (
      backup_retention_count !== undefined &&
      (!Number.isFinite(Number(backup_retention_count)) || Number(backup_retention_count) < 1)
    ) {
      return error("backup_retention_count must be a positive number");
    }

    const updates: Array<{ key: string; value: string }> = [];
    if (backup_schedule_enabled !== undefined)
      updates.push({ key: "backup_schedule_enabled", value: String(backup_schedule_enabled) === "true" ? "true" : "false" });
    if (backup_schedule_frequency !== undefined)
      updates.push({ key: "backup_schedule_frequency", value: String(backup_schedule_frequency) });
    if (backup_retention_count !== undefined)
      updates.push({ key: "backup_retention_count", value: String(Math.floor(Number(backup_retention_count))) });

    await Promise.all(
      updates.map((u) =>
        prisma.setting.upsert({
          where: { key: u.key },
          update: { value: u.value, group: "backup" },
          create: { key: u.key, value: u.value, group: "backup" },
        })
      )
    );

    return ok({ message: "Backup schedule updated" });
  } catch (e) {
    return serverError(e);
  }
}
