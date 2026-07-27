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
 * detail pages). Re-subscribing with the same email reactivates it instead
 * of erroring, so the form never has to reveal whether an address already
 * exists.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = subscribeSchema.safeParse(body);
    if (!parsed.success) return error(parsed.error.issues[0].message);

    const { email, source, language } = parsed.data;

    await prisma.newsletterSubscriber.upsert({
      where: { email },
      update: { isActive: true, ...(source && { source }), ...(language && { language }) },
      create: { email, source, language, isActive: true },
    });

    return ok({ message: "Subscribed" }, 201);
  } catch (e) {
    return serverError(e);
  }
}
