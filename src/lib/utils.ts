export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function generateOrderNumber(): string {
  const date = new Date();
  const yy = date.getFullYear().toString().slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const random = Math.floor(Math.random() * 9000) + 1000;
  return `HD-${yy}${mm}${dd}-${random}`;
}

export function formatOMR(amount: number | string): string {
  return Number(amount).toFixed(3);
}

/**
 * Renders a cart/order line's variant as "Sleeves: Yellow, Body: Blue / M".
 * Prefers the per-area color breakdown (a single item that mixes colors by
 * region) over the flat color name when both are present.
 */
export function formatVariantLabel(opts: {
  color?: string | null;
  colorParts?: { part: string; color: string }[] | null;
  size?: string | null;
}): string {
  const colorLabel =
    opts.colorParts && opts.colorParts.length > 0
      ? opts.colorParts.map((p) => `${p.part}: ${p.color}`).join(", ")
      : opts.color || "";
  return [colorLabel, opts.size].filter(Boolean).join(" / ");
}

export function getPaginationParams(searchParams: URLSearchParams) {
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "20")));
  const skip = (page - 1) * pageSize;
  return { page, pageSize, skip };
}
