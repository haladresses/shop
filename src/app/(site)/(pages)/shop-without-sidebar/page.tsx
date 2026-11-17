import { redirect } from "next/navigation";

// Template leftover: the one product listing is /shop.
export default function ShopWithoutSidebarPage() {
  redirect("/shop");
}
