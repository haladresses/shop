import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { getAuthFromRequest, userHasPermission } from "@/lib/auth";
import { ok, paginated, error, unauthorized, forbidden, serverError } from "@/lib/api/response";

export async function GET(req: NextRequest) {
  try {
    const admin = await getAuthFromRequest(req);
    if (!admin) return unauthorized();
    if (!(await userHasPermission(admin, "admin.newsletter.view"))) return forbidden();

    const sp = req.nextUrl.searchParams;
    const page = Math.max(1, parseInt(sp.get("page") || "1"));
    const pageSize = Math.min(100, parseInt(sp.get("pageSize") || "50"));
    const skip = (page - 1) * pageSize;
    const search = sp.get("search") || "";

    const where = search
      ? { email: { contains: search, mode: "insensitive" as const } }
      : {};

    const [subscribers, total] = await Promise.all([
      prisma.newsletterSubscriber.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: "desc" },
      }),
      prisma.newsletterSubscriber.count({ where }),
    ]);

    return paginated(subscribers, { page, pageSize, total });
  } catch (e) {
    return serverError(e);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const admin = await getAuthFromRequest(req);
    if (!admin) return unauthorized();
    if (!(await userHasPermission(admin, "admin.newsletter.manage"))) return forbidden();

    const id = req.nextUrl.searchParams.get("id");
    if (!id) return error("Missing subscriber id");

    await prisma.newsletterSubscriber.delete({ where: { id } });
    return ok({ message: "Deleted" });
  } catch (e) {
    return serverError(e);
  }
}
