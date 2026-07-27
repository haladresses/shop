import { Metadata } from "next";
import LegalPageView from "@/components/Legal/LegalPageView";
import { DEFAULT_REFUND_POLICY } from "@/lib/legalPages";

export const metadata: Metadata = {
  title: "Return & Exchange Policy | Hala Dresses",
  description: "Hala Dresses return, exchange, and refund policy, in line with Oman's Consumer Protection Law.",
};

const RefundPolicyPage = () => {
  return (
    <main>
      <LegalPageView endpoint="/api/refund-policy" fallback={DEFAULT_REFUND_POLICY} />
    </main>
  );
};

export default RefundPolicyPage;
