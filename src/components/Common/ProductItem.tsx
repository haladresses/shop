"use client";
import ProductCard from "./ProductCard";
import { Product } from "@/types/product";

// Kept as the shared entry point used by the home sections & related lists.
const ProductItem = ({ item }: { item: Product }) => <ProductCard item={item} />;

export default ProductItem;
