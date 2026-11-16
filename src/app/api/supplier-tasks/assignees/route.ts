import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { ok, serverError } from "@/lib/api/response";
import { guard } from "@/lib/api/guard";

/** Staff who can be given a purchasing task. */
export async function GET(req: NextRequest) {
  try {
    const g = await guard(req, "admin.suppliers.view");
    if ("res" in g) return g.res;
    const users = await prisma.user.findMany({
      where: { isActive: true, role: { in: ["SUPER_ADMIN", "ADMIN", "STAFF"] } },
      select: { id: true, nameEn: true, nameAr: true, email: true, role: true },
      orderBy: [{ nameEn: "asc" }, { email: "asc" }],
    });
    return ok(users.map((u) => ({ ...u, name: u.nameEn || u.nameAr || u.email, isMe: u.id === g.user.id })));
  } catch (e) {
    return serverError(e);
  }
}
