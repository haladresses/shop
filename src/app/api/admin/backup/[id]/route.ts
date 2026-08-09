import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { Role } from "@prisma/client";
import { getAuthFromRequest, userHasPermission } from "@/lib/auth";
import { ok, unauthorized, forbidden, notFound, serverError } from "@/lib/api/response";
import { deleteBackup } from "@/lib/backup";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const admin = await getAuthFromRequest(req);
    if (!admin) return unauthorized();
    if (!(await userHasPermission(admin, "admin.backups.delete")) && admin.role !== Role.SUPER_ADMIN) {
      return forbidden();
    }

    const { id } = await params;
    const backup = await prisma.backup.findUnique({ where: { id } });
    if (!backup) return notFound("Backup");

    await deleteBackup(id);
    return ok({ message: "Backup deleted" });
  } catch (e) {
    return serverError(e);
  }
}
