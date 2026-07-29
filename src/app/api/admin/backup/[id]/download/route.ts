import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { Readable } from "stream";
import prisma from "@/lib/db";
import { getAuthFromRequest, isAdminRole } from "@/lib/auth";
import { unauthorized, forbidden, notFound, serverError } from "@/lib/api/response";
import { BACKUP_DIR } from "@/lib/backup";
import { BackupStatus } from "@prisma/client";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const admin = await getAuthFromRequest(req);
    if (!admin) return unauthorized();
    if (!isAdminRole(admin.role)) return forbidden();

    const { id } = await params;
    const backup = await prisma.backup.findUnique({ where: { id } });
    if (!backup || backup.status !== BackupStatus.COMPLETED) return notFound("Backup");

    const filePath = path.join(BACKUP_DIR, backup.filename);
    if (!fs.existsSync(filePath)) return notFound("Backup file");

    const stat = await fs.promises.stat(filePath);
    const nodeStream = fs.createReadStream(filePath);
    const webStream = Readable.toWeb(nodeStream) as ReadableStream;

    return new NextResponse(webStream, {
      headers: {
        "Content-Type": "application/gzip",
        "Content-Length": String(stat.size),
        "Content-Disposition": `attachment; filename="${backup.filename}"`,
      },
    });
  } catch (e) {
    return serverError(e);
  }
}
