import { z } from "zod";

// Shoppers sign in / up with EITHER an email or a mobile number, typed in a
// single field (`identifier`). `email` is still accepted for older clients.
export const loginSchema = z
  .object({
    identifier: z.string().trim().optional(),
    email: z.string().trim().optional(),
    password: z.string().min(1, "Enter your password"),
  })
  .refine((d) => !!(d.identifier || d.email), { message: "Enter your email or mobile number" });

export const registerSchema = z
  .object({
    identifier: z.string().trim().optional(),
    email: z.string().trim().optional(),
    password: z.string().min(6, "Password must be at least 6 characters"),
    nameEn: z.string().trim().min(2, "Name must be at least 2 characters"),
    nameAr: z.string().optional(),
    phone: z.string().optional(),
  })
  .refine((d) => !!(d.identifier || d.email), { message: "Enter your email or mobile number" });

/** Domain for the internal address given to phone-only accounts (email is required in the DB). */
export const PHONE_ACCOUNT_DOMAIN = "phone.haladresses.local";

const toLatinDigits = (s: string) =>
  s.replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06f0));

/** Normalise a phone typed any way (Arabic/Persian digits, spaces, 00, local 8 digits) to +<country><number>. */
export function normalizePhone(raw: string): string | null {
  let digits = toLatinDigits(raw).replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 8) digits = `968${digits}`; // local Omani mobile/landline
  if (digits.length < 8 || digits.length > 15) return null;
  return `+${digits}`;
}

/** Ways an existing phone may already be stored (older rows weren't normalised). */
export function phoneCandidates(normalized: string): string[] {
  const d = normalized.replace(/\D/g, "");
  const local = d.startsWith("968") ? d.slice(3) : d;
  return Array.from(new Set([normalized, d, local, `+968${local}`, `968${local}`, `+968 ${local}`, `00${d}`]));
}

export type ParsedIdentifier = { kind: "email"; email: string } | { kind: "phone"; phone: string } | { kind: "invalid" };

export function parseIdentifier(raw: string): ParsedIdentifier {
  const v = toLatinDigits(raw).trim();
  if (v.includes("@")) {
    const email = v.toLowerCase();
    return z.string().email().safeParse(email).success ? { kind: "email", email } : { kind: "invalid" };
  }
  const phone = normalizePhone(v);
  return phone ? { kind: "phone", phone } : { kind: "invalid" };
}

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;

/** Phone-only accounts carry an internal placeholder email — never show it. */
export const publicEmail = (email: string) => (email.endsWith(`@${PHONE_ACCOUNT_DOMAIN}`) ? null : email);
