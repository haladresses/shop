import { NextRequest } from "next/server";
import fs from "fs";
import { promises as fsp } from "fs";
import os from "os";
import path from "path";
import { randomUUID } from "crypto";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import type { ReadableStream as NodeReadableStream } from "stream/web";
import { BackupStatus } from "@prisma/client";
import prisma from "@/lib/db";
import { getAuthFromRequest, userHasPermission } from "@/lib/auth";
import { ok, error, unauthorized, forbidden } from "@/lib/api/response";
import { restoreBackup, BACKUP_DIR, BackupError, describeBackupError } from "@/lib/backup";

export const runtime = "nodejs";

const CONFIRMATION_PHRASE = "RESTORE";

function sessionTokenOf(req: NextRequest): string | undefined {
  return (
    req.cookies.get("session_token")?.value ||
    req.headers.get("Authorization")?.replace("Bearer ", "") ||
    undefined
  );
}

export async function POST(req: NextRequest) {
  let uploadPath: string | null = null;

  try {
    const admin = await getAuthFromRequest(req);
    if (!admin) return unauthorized();
    if (!(await userHasPermission(admin, "admin.backups.restore"))) return forbidden();

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return error("The upload could not be read. It may have been interrupted. Try again.");
    }

    if (formData.get("confirm") !== CONFIRMATION_PHRASE) {
      return error(`Type "${CONFIRMATION_PHRASE}" to confirm this action`);
    }

    const restoreFiles = formData.get("restoreFiles") !== "false";
    const backupId = formData.get("backupId");
    const uploaded = formData.get("file");

    let archivePath: string;
    let source: string;

    if (typeof backupId === "string" && backupId) {
      const backup = await prisma.backup.findUnique({ where: { id: backupId } });
      if (!backup || backup.status !== BackupStatus.COMPLETED) {
        return error("Backup not found", 404);
      }
      archivePath = path.join(BACKUP_DIR, backup.filename);
      if (!fs.existsSync(archivePath)) {
        return error("The file of this backup is missing from the server's backups folder.", 404);
      }
      source = backup.filename;
    } else if (uploaded instanceof File && uploaded.size > 0) {
      // The archive's content is checked by restoreBackup, so any file name is accepted here.
      uploadPath = path.join(
        /* turbopackIgnore: true */ os.tmpdir(),
        `hala-restore-upload-${randomUUID()}`
      );
      await pipeline(
        Readable.fromWeb(uploaded.stream() as unknown as NodeReadableStream),
        fs.createWriteStream(uploadPath)
      );
      archivePath = uploadPath;
      source = uploaded.name;
    } else {
      return error("Choose a backup from the history or upload a backup file");
    }

    const result = await restoreBackup(archivePath, {
      restoreFiles,
      userId: admin.id,
      sessionToken: sessionTokenOf(req),
    });

    // The admin's account may not exist in the restored data.
    const adminStillExists = (await prisma.user.count({ where: { id: admin.id } })) > 0;
    await prisma.auditLog
      .create({
        data: {
          userId: adminStillExists ? admin.id : null,
          action: "RESTORE",
          entity: "Database",
          entityId: typeof backupId === "string" && backupId ? backupId : "uploaded-file",
          newData: {
            source,
            restoredBy: admin.email,
            backupCreatedAt: result.backupCreatedAt,
            safetyBackupId: result.safetyBackupId,
            schemaUpdates: result.schemaUpdates,
            filesRestored: result.filesRestored,
            warnings: result.warnings,
          },
        },
      })
      .catch((e) => console.error("[backup restore] could not write the audit log:", e));

    return ok(result);
  } catch (e) {
    console.error("[backup restore]", e);
    if (e instanceof BackupError) return error(e.message, e.status);
    return error(`Restore failed: ${describeBackupError(e)}`, 500);
  } finally {
    if (uploadPath) await fsp.rm(uploadPath, { force: true }).catch(() => {});
  }
}
