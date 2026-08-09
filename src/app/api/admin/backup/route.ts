import { NextRequest } from "next/server";
import { BackupType } from "@prisma/client";
import prisma from "@/lib/db";
import { getAuthFromRequest, userHasPermission } from "@/lib/auth";
import { ok, unauthorized, forbidden, serverError } from "@/lib/api/response";
import { createBackup, serializeBackup } from "@/lib/backup";

export async function GET(req: NextRequest) {
  try {
    const admin = await getAuthFromRequest(req);
    if (!admin) return unauthorized();
    if (!(await userHasPermission(admin, "admin.backups.view"))) return forbidden();

    const backups = await prisma.backup.findMany({ orderBy: { createdAt: "desc" } });
    return ok(backups.map(serializeBackup));
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await getAuthFromRequest(req);
    if (!admin) return unauthorized();
    if (!(await userHasPermission(admin, "admin.backups.create"))) return forbidden();

    const backup = await createBackup({ type: BackupType.MANUAL, userId: admin.id });
    return ok(serializeBackup(backup), 201);
  } catch (e) {
    return serverError(e);
  }
}
