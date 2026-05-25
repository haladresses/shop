import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/db";
import { ok, serverError } from "@/lib/api/response";

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("session_token")?.value;

    if (token) {
      await prisma.session.deleteMany({ where: { token } });
      cookieStore.delete("session_token");
    }

    return ok({ message: "Logged out" });
  } catch (e) {
    return serverError(e);
  }
}
