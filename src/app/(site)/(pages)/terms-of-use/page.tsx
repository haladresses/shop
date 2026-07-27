import { Metadata } from "next";
import LegalPageView from "@/components/Legal/LegalPageView";
import { DEFAULT_TERMS_OF_USE } from "@/lib/legalPages";

export const metadata: Metadata = {
  title: "Terms of Use | Hala Dresses",
  description: "The terms and conditions for shopping with Hala Dresses.",
};

const TermsOfUsePage = () => {
  return (
    <main>
      <LegalPageView endpoint="/api/terms-of-use" fallback={DEFAULT_TERMS_OF_USE} />
    </main>
  );
};

export default TermsOfUsePage;
