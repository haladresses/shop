import { NextRequest } from "next/server";
import { readFile, stat } from "fs/promises";
import path from "path";

// Serve images from the on-disk `public/images` tree (Docker volumes in
// production). Next.js only serves files that exist in `public/` at build time,
// so images uploaded at runtime (products, categories, hero, promo banners,
// testimonials, countdown, whatsapp reviews, …) are not picked up by the static
// handler and 404. Baked-in images are still served by the static handler first;
// this catch-all only handles the runtime-added misses, reading them from disk.

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
};

const IMAGES_ROOT = path.join(process.cwd(), "public", "images");

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await params;

  const contentType = CONTENT_TYPES[path.extname(segments.at(-1) ?? "").toLowerCase()];
  if (!contentType) {
    return new Response("Not found", { status: 404 });
  }

  // Resolve the requested path and ensure it stays within `public/images`.
  const filePath = path.normalize(path.join(IMAGES_ROOT, ...segments));
  if (filePath !== IMAGES_ROOT && !filePath.startsWith(IMAGES_ROOT + path.sep)) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) {
      return new Response("Not found", { status: 404 });
    }

    const file = await readFile(filePath);
    return new Response(file, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(fileStat.size),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
