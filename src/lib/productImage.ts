/**
 * The branded picture shown wherever a product has no photo yet (storefront,
 * POS, admin, orders). Nothing is stored on the product: as soon as a real
 * photo is uploaded it takes this one's place everywhere.
 */
export const PRODUCT_PLACEHOLDER = "/images/placeholders/product.webp";

/** The product's first photo, or the default picture when it has none. */
export function productImageUrl(images?: { url: string }[] | null): string {
  return images?.[0]?.url || PRODUCT_PLACEHOLDER;
}
