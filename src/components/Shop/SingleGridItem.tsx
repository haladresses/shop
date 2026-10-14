"use client";
import ProductCard from "../Common/ProductCard";
import { Product } from "@/types/product";

// Shop grid tile — same card as the rest of the storefront.
const SingleGridItem = ({ item }: { item: Product }) => <ProductCard item={item} />;

export default SingleGridItem;
