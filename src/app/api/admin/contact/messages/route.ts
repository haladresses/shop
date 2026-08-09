import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { getAuthFromRequest, userHasPermission } from "@/lib/auth";
import { ok, error, unauthorized, forbidden, notFound, serverError } from "@/lib/api/response";
import type { Prisma } from "@prisma/client";

const STATUSES = ["new", "read", "archived"] as const;
type Status = (typeof STATUSES)[number];

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthFromRequest(req);
    if (!user) return unauthorized();
    if (!(await userHasPermission(user, "admin.contact.view"))) return forbidden();

    const statusParam = req.nextUrl.searchParams.get("status") || "all";
    const q = (req.nextUrl.searchParams.get("q") || "").trim();

    const where: Prisma.ContactMessageWhereInput = {};
    if (STATUSES.includes(statusParam as Status)) where.status = statusParam;
    if (q) {
      where.OR = [
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
        { subject: { contains: q, mode: "insensitive" } },
        { phone: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { message: { contains: q, mode: "insensitive" } },
      ];
    }

    const [messages, grouped] = await Promise.all([
      prisma.contactMessage.findMany({ where, orderBy: { createdAt: "desc" }, take: 500 }),
      prisma.contactMessage.groupBy({ by: ["status"], _count: { _all: true } }),
    ]);

    const counts = { all: 0, new: 0, read: 0, archived: 0 } as Record<string, number>;
    for (const row of grouped) {
      counts[row.status] = row._count._all;
      counts.all += row._count._all;
    }

    return ok({ messages, counts });
  } catch (e) {
    return serverError(e);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getAuthFromRequest(req);
    if (!user) return unauthorized();
    if (!(await userHasPermission(user, "admin.contact.manage"))) return forbidden();

    const body = await req.json().catch(() => null);
    const id = body && typeof body.id === "string" ? body.id : "";
    const status = body && typeof body.status === "string" ? body.status : "";
    if (!id) return error("Message id is required");
    if (!STATUSES.includes(status as Status)) return error("Invalid status");

    const existing = await prisma.contactMessage.findUnique({ where: { id } });
    if (!existing) return notFound("Message");

    const updated = await prisma.contactMessage.update({ where: { id }, data: { status } });
    return ok(updated);
  } catch (e) {
    return serverError(e);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getAuthFromRequest(req);
    if (!user) return unauthorized();
    if (!(await userHasPermission(user, "admin.contact.manage"))) return forbidden();

    const id = req.nextUrl.searchParams.get("id") || "";
    if (!id) return error("Message id is required");

    const existing = await prisma.contactMessage.findUnique({ where: { id } });
    if (!existing) return notFound("Message");

    await prisma.contactMessage.delete({ where: { id } });
    return ok({ message: "Message deleted" });
  } catch (e) {
    return serverError(e);
  }
}
