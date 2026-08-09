import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import prisma from "./db";
import { Role } from "@prisma/client";
import { getPermissionsForRole, roleHasPermission } from "@/lib/permissions";

export const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function createSession(userId: string) {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  await prisma.session.create({
    data: { userId, token, expiresAt },
  });

  return token;
}

export async function getSessionUser(token: string) {
  const session = await prisma.session.findUnique({
    where: { token },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          nameEn: true,
          nameAr: true,
          role: true,
          isActive: true,
          avatar: true,
        },
      },
    },
  });

  if (!session || session.expiresAt < new Date()) return null;
  if (!session.user.isActive) return null;

  return session.user;
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session_token")?.value;
  if (!token) return null;
  return getSessionUser(token);
}

export async function getCurrentUserWithPermissions() {
  const user = await getCurrentUser();
  if (!user) return null;
  const permissions = await getPermissionsForRole(user.role);
  return { ...user, permissions };
}

export async function requireAuth(allowedRoles?: Role[]) {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHORIZED");
  if (allowedRoles && !allowedRoles.includes(user.role)) throw new Error("FORBIDDEN");
  return user;
}

export async function getAuthFromRequest(req: NextRequest) {
  const token =
    req.cookies.get("session_token")?.value ||
    req.headers.get("Authorization")?.replace("Bearer ", "");

  if (!token) return null;
  return getSessionUser(token);
}

export async function userHasPermission(user: { role: Role }, permission: string): Promise<boolean> {
  return roleHasPermission(user.role, permission);
}

export async function userHasAnyPermission(
  user: { role: Role },
  permissions: string[]
): Promise<boolean> {
  for (const permission of permissions) {
    if (await roleHasPermission(user.role, permission)) return true;
  }
  return false;
}

export function isAdminRole(role: Role): boolean {
  return ([Role.SUPER_ADMIN, Role.ADMIN, Role.STAFF] as Role[]).includes(role);
}

export function isSellerOrAdmin(role: Role): boolean {
  return ([Role.SUPER_ADMIN, Role.ADMIN, Role.SELLER] as Role[]).includes(role);
}
