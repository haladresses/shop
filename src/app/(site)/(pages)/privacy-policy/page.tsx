import { Metadata } from "next";
import LegalPageView from "@/components/Legal/LegalPageView";
import { DEFAULT_PRIVACY_POLICY } from "@/lib/legalPages";

export const metadata: Metadata = {
  title: "Privacy Policy | Hala Dresses",
  description: "How Hala Dresses collects, uses, and protects your personal information.",
};

const PrivacyPolicyPage = () => {
  return (
    <main>
      <LegalPageView endpoint="/api/privacy-policy" fallback={DEFAULT_PRIVACY_POLICY} />
    </main>
  );
};

export default PrivacyPolicyPage;
