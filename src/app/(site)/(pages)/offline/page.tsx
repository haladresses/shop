import React from "react";
import Offline from "@/components/Offline";

import { Metadata } from "next";
export const metadata: Metadata = {
  title: "You're Offline | Hala Dresses",
  description: "This page is shown when you lose your internet connection.",
};

const OfflinePage = () => {
  return (
    <main>
      <Offline />
    </main>
  );
};

export default OfflinePage;
