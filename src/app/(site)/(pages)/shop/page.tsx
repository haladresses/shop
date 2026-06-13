import React from "react";
import ShopWithSidebar from "@/components/ShopWithSidebar";

import { Metadata } from "next";
export const metadata: Metadata = {
  title: "Shop | Hala Dresses",
  description: "Browse the Hala Dresses collection of occasionwear, modest dressing, and elevated event pieces.",
  // other metadata
};

const ShopPage = () => {
  return (
    <main>
      <ShopWithSidebar />
    </main>
  );
};

export default ShopPage;
