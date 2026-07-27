import { Metadata } from "next";
import FaqView from "@/components/Legal/FaqView";

export const metadata: Metadata = {
  title: "FAQ | Hala Dresses",
  description: "Answers to frequently asked questions about ordering, shipping, and returns at Hala Dresses.",
};

const FaqPage = () => {
  return (
    <main>
      <FaqView />
    </main>
  );
};

export default FaqPage;
