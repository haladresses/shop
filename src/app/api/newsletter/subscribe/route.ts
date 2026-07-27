import { NextRequest } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db";
import { ok, error, serverError } from "@/lib/api/response";

const subscribeSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  source: z.string().max(100).optional(),
  language: z.enum(["en", "ar"]).optional(),
});

/**
 * Public endpoint used by the storefront newsletter form (homepage + product
 * detail pages). Distinguishes three outcomes so the UI can show the right
 * message: brand-new subscriber, reactivated (was previously unsubscribed),
 * or already an active subscriber (duplicate submission).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = subscribeSchema.safeParse(body);
    if (!parsed.success) return error("invalid_email");

    const { email, source, language } = parsed.data;

    const existing = await prisma.newsletterSubscriber.findUnique({ where: { email } });
    const alreadyActive = existing?.isActive === true;

    await prisma.newsletterSubscriber.upsert({
      where: { email },
      update: { isActive: true, ...(source && { source }), ...(language && { language }) },
      create: { email, source, language, isActive: true },
    });

    return ok({ isNew: !existing, alreadyActive }, existing ? 200 : 201);
  } catch (e) {
    return serverError(e);
  }
}
