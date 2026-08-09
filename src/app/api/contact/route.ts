import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { created, error, serverError } from "@/lib/api/response";

function clean(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return error("Invalid request body");

    const firstName = clean((body as Record<string, unknown>).firstName, 80);
    const lastName = clean((body as Record<string, unknown>).lastName, 80);
    const subject = clean((body as Record<string, unknown>).subject, 160);
    const phone = clean((body as Record<string, unknown>).phone, 40);
    const email = clean((body as Record<string, unknown>).email, 160);
    const message = clean((body as Record<string, unknown>).message, 4000);
    const languageRaw = clean((body as Record<string, unknown>).language, 5).toLowerCase();
    const language = languageRaw === "ar" ? "ar" : "en";

    if (!firstName) return error("Please enter your name");
    if (!message) return error("Please enter a message");

    await prisma.contactMessage.create({
      data: {
        firstName,
        lastName: lastName || null,
        subject: subject || null,
        phone: phone || null,
        email: email || null,
        message,
        language,
        status: "new",
      },
    });

    return created({ message: "Your message has been sent." });
  } catch (e) {
    return serverError(e);
  }
}
