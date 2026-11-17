import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import prisma from "@/lib/db";
import { verifyUnlock } from "@/lib/pos";
import { ok, error, unauthorized, serverError } from "@/lib/api/response";

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("lock") }),
  z.object({ action: z.literal("unlock"), secret: z.string().min(1).max(200) }),
]);

/** This browser's session, locked or not. Null when signed out, expired or deactivated. */
async function currentSession() {
  const token = (await cookies()).get("session_token")?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { token },
    select: {
      id: true,
      expiresAt: true,
      lockedAt: true,
      user: {
        select: {
          id: true,
          nameEn: true,
          nameAr: true,
          avatar: true,
          isActive: true,
          passwordHash: true,
          posPinHash: true,
          posPinAttempts: true,
          posPinLockedUntil: true,
        },
      },
    },
  });
  if (!session || session.expiresAt < new Date() || !session.user.isActive) return null;
  return session;
}

type SessionUser = NonNullable<Awaited<ReturnType<typeof currentSession>>>["user"];

/** What the lock screen shows: name, photo and whether to ask for a PIN or a password. */
const lockUser = (u: SessionUser) => ({ nameEn: u.nameEn, nameAr: u.nameAr, avatar: u.avatar, usePin: !!u.posPinHash });

/** Is this terminal locked, and by whom (so a reload lands on the lock screen, not the staff picker). */
export async function GET() {
  try {
    const s = await currentSession();
    if (!s?.lockedAt) return ok({ locked: false });
    return ok({ locked: true, user: lockUser(s.user) });
  } catch (e) {
    return serverError(e);
  }
}

/**
 * Lock or unlock the POS screen. A locked session counts as signed out for
 * every request (no sales, no admin) until the same person unlocks it with
 * their PIN, or their password if they have no PIN.
 */
export async function POST(req: NextRequest) {
  try {
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) return error(parsed.error.issues[0].message);

    const s = await currentSession();
    if (!s) return unauthorized();

    if (parsed.data.action === "lock") {
      if (!s.lockedAt) await prisma.session.update({ where: { id: s.id }, data: { lockedAt: new Date() } });
      return ok({ locked: true, user: lockUser(s.user) });
    }

    const result = await verifyUnlock(s.user, parsed.data.secret);
    if (!result.ok) return error(result.error || "Incorrect PIN.");
    if (s.lockedAt) await prisma.session.update({ where: { id: s.id }, data: { lockedAt: null } });
    return ok({ locked: false, user: lockUser(s.user) });
  } catch (e) {
    return serverError(e);
  }
}
