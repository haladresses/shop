import prisma from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth";

export const PIN_LENGTH = 4;
export const PIN_MAX_ATTEMPTS = 5;
export const PIN_LOCKOUT_MINUTES = 15;

export function isValidPin(pin: string): boolean {
  return new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin);
}

export async function hashPin(pin: string): Promise<string> {
  return hashPassword(pin);
}

type PinCheckUser = {
  id: string;
  posPinHash: string | null;
  posPinAttempts: number;
  posPinLockedUntil: Date | null;
};

/**
 * Verifies a PIN against the stored hash with attempt-count lockout — PINs
 * are only 10,000 combinations, so this must be rate-limited per user.
 */
export async function verifyPin(
  user: PinCheckUser,
  pin: string
): Promise<{ ok: boolean; error: string | null }> {
  if (!user.posPinHash) return { ok: false, error: "This account has no POS PIN set." };

  if (user.posPinLockedUntil && user.posPinLockedUntil > new Date()) {
    const minutes = Math.ceil((user.posPinLockedUntil.getTime() - Date.now()) / 60000);
    return { ok: false, error: `Too many attempts. Try again in ${minutes} minute(s).` };
  }

  const valid = await verifyPassword(pin, user.posPinHash);

  if (!valid) {
    const attempts = user.posPinAttempts + 1;
    const lockedOut = attempts >= PIN_MAX_ATTEMPTS;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        posPinAttempts: lockedOut ? 0 : attempts,
        posPinLockedUntil: lockedOut
          ? new Date(Date.now() + PIN_LOCKOUT_MINUTES * 60 * 1000)
          : null,
      },
    });
    return {
      ok: false,
      error: lockedOut
        ? `Too many attempts. Try again in ${PIN_LOCKOUT_MINUTES} minute(s).`
        : "Incorrect PIN.",
    };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { posPinAttempts: 0, posPinLockedUntil: null },
  });
  return { ok: true, error: null };
}
