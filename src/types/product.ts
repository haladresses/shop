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
};
