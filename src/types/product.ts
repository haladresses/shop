export type ProductOption = {
  variantId: string;
  color: string | null;
  colorHex: string | null;
  size: string | null;
  priceAdjustment: number;
  stock: number;
};

export type Product = {
  title: string;
  reviews: number;
  price: number;
  discountedPrice: number;
  id: string;
  slug?: string;
  variantId?: string;
  imgs?: {
    thumbnails: string[];
    previews: string[];
  };
  // Optional catalogue details (present when mapped from the products API).
  isNew?: boolean;
  isBestSeller?: boolean;
  categoryName?: string;
  /** Sellable options (color/size) with live stock. Empty = simple product. */
  options?: ProductOption[];
  /** Distinct colours across the options, for card swatches. */
  colors?: { name: string; hex: string | null }[];
  /** False when every option is sold out. */
  inStock?: boolean;
};
