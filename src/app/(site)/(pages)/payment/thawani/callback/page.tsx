import React from "react";
import PaymentThawaniCallback from "@/components/PaymentThawaniCallback";

import { Metadata } from "next";
export const metadata: Metadata = {
  title: "Payment Status | Hala Dresses",
  description: "Thawani payment confirmation for your Hala Dresses order.",
};

const PaymentThawaniCallbackPage = () => {
  return (
    <main>
      <PaymentThawaniCallback />
    </main>
  );
};

export default PaymentThawaniCallbackPage;
