import { NextRequest } from "next/server";
import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import prisma from "@/lib/db";
import { getAuthFromRequest, userHasAnyPermission } from "@/lib/auth";
import { ok, created, error, unauthorized, forbidden, notFound, serverError } from "@/lib/api/response";

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/gif": "gif",
};
const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const MANAGE_PERMISSIONS = ["admin.reviews.manage", "admin.products.manage"];

// Public: list the WhatsApp review screenshots for a product.
export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const reviews = await prisma.productWhatsappReview.findMany({
      where: { productId: id },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    return ok(reviews);
  } catch (e) {
    return serverError(e);
  }
}

// Admin: upload a screenshot and attach it to the product.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthFromRequest(req);
    if (!user) return unauthorized();
    if (!(await userHasAnyPermission(user, MANAGE_PERMISSIONS))) return forbidden();

    const { id } = await params;
    const product = await prisma.product.findUnique({ where: { id }, select: { id: true } });
    if (!product) return notFound("Product");

    const formData = await req.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof File)) return error("No screenshot provided");

    const ext = ALLOWED_TYPES[file.type];
    if (!ext) return error("Unsupported file type. Use JPG, PNG, WEBP, AVIF or GIF.");
    if (file.size > MAX_SIZE) return error("File too large. Maximum size is 5MB.");

    const customerName = String(formData.get("customerName") || "").trim().slice(0, 120) || null;
    const caption = String(formData.get("caption") || "").trim().slice(0, 500) || null;

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = `${randomUUID()}.${ext}`;
    const uploadDir = path.join(process.cwd(), "public", "images", "whatsapp-reviews");
    await mkdir(uploadDir, { recursive: true });
    await writeFile(path.join(uploadDir, fileName), buffer);

    const last = await prisma.productWhatsappReview.findFirst({
      where: { productId: id },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });

    const review = await prisma.productWhatsappReview.create({
      data: {
        productId: id,
        imageUrl: `/images/whatsapp-reviews/${fileName}`,
        customerName,
        caption,
        sortOrder: (last?.sortOrder ?? 0) + 1,
      },
    });

    return created(review);
  } catch (e) {
    return serverError(e);
  }
}

// Admin: delete a screenshot.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthFromRequest(req);
    if (!user) return unauthorized();
    if (!(await userHasAnyPermission(user, MANAGE_PERMISSIONS))) return forbidden();

    const { id } = await params;
    const reviewId = req.nextUrl.searchParams.get("reviewId") || "";
    if (!reviewId) return error("reviewId is required");

    const review = await prisma.productWhatsappReview.findFirst({ where: { id: reviewId, productId: id } });
    if (!review) return notFound("Review");

    await prisma.productWhatsappReview.delete({ where: { id: reviewId } });

    // Best-effort removal of the stored file.
    if (review.imageUrl.startsWith("/images/whatsapp-reviews/")) {
      await unlink(path.join(process.cwd(), "public", review.imageUrl)).catch(() => {});
    }

    return ok({ message: "Review deleted" });
  } catch (e) {
    return serverError(e);
  }
}
