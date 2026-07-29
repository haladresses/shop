import { NextRequest } from "next/server";
import fs from "fs";
import { promises as fsp } from "fs";
import os from "os";
import path from "path";
import { randomUUID } from "crypto";
import { Role, BackupStatus } from "@prisma/client";
import prisma from "@/lib/db";
import { getAuthFromRequest } from "@/lib/auth";
import { ok, error, unauthorized, forbidden, serverError } from "@/lib/api/response";
import { restoreBackup, BACKUP_DIR } from "@/lib/backup";

const CONFIRMATION_PHRASE = "RESTORE";

export async function POST(req: NextRequest) {
  let tempFilePath: string | null = null;

  try {
    const admin = await getAuthFromRequest(req);
    if (!admin) return unauthorized();
    // Restoring overwrites the live database and files — the most destructive
    // action in the admin panel, so it is limited to super admins only.
    if (admin.role !== Role.SUPER_ADMIN) return forbidden();

    const formData = await req.formData();
    const confirm = formData.get("confirm");
    if (confirm !== CONFIRMATION_PHRASE) {
      return error(`Type "${CONFIRMATION_PHRASE}" to confirm this action`);
    }

    const restoreFiles = formData.get("restoreFiles") !== "false";
    const backupId = formData.get("backupId");
    const uploaded = formData.get("file");

    let sourcePath: string;

    if (typeof backupId === "string" && backupId) {
      const backup = await prisma.backup.findUnique({ where: { id: backupId } });
      if (!backup || backup.status !== BackupStatus.COMPLETED) {
        return error("Backup not found", 404);
      }
      sourcePath = path.join(BACKUP_DIR, backup.filename);
      if (!fs.existsSync(sourcePath)) return error("Backup file is missing on disk", 404);
    } else if (uploaded instanceof File) {
      if (!uploaded.name.endsWith(".tar.gz")) {
        return error("Backup file must be a .tar.gz archive");
      }
      await fsp.mkdir(BACKUP_DIR, { recursive: true });
      tempFilePath = path.join(
        /* turbopackIgnore: true */ os.tmpdir(),
        `hala-restore-upload-${randomUUID()}.tar.gz`
      );
      const buffer = Buffer.from(await uploaded.arrayBuffer());
      await fsp.writeFile(tempFilePath, buffer);
      sourcePath = tempFilePath;
    } else {
      return error("Provide either an existing backupId or upload a backup file");
    }

    await restoreBackup(sourcePath, { restoreFiles });

    await prisma.auditLog
      .create({
        data: {
          userId: admin.id,
          action: "RESTORE",
          entity: "Database",
          entityId: typeof backupId === "string" ? backupId : "uploaded-file",
        },
      })
      .catch(() => {});

    return ok({
      message:
        "Restore completed. Active sessions were reset by the restored data — you may need to sign in again.",
    });
  } catch (e) {
    return serverError(e);
  } finally {
    if (tempFilePath) await fsp.rm(tempFilePath, { force: true }).catch(() => {});
  }
}
