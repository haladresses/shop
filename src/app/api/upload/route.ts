import { NextRequest } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { getAuthFromRequest, userHasAnyPermission } from "@/lib/auth";
import { ok, error, unauthorized, forbidden, serverError } from "@/lib/api/response";

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/gif": "gif",
};
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthFromRequest(req);
    if (!user) return unauthorized();
    if (!(await userHasAnyPermission(user, ["admin.products.manage", "seller.uploads.manage"]))) {
      return forbidden();
    }

    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return error("No file provided");
    }

    const ext = ALLOWED_TYPES[file.type];
    if (!ext) {
      return error("Unsupported file type. Use JPG, PNG, WEBP, AVIF or GIF.");
    }
    if (file.size > MAX_SIZE) {
      return error("File too large. Maximum size is 5MB.");
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = `${randomUUID()}.${ext}`;
    const uploadDir = path.join(process.cwd(), "public", "images", "products");
    await mkdir(uploadDir, { recursive: true });
    await writeFile(path.join(uploadDir, fileName), buffer);

    return ok({ url: `/images/products/${fileName}` }, 201);
  } catch (e) {
    return serverError(e);
  }
}
