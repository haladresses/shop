import Home from "@/components/Home";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Hala Dresses | Women and Kids Fashion in Oman | هلا دريسز للأزياء النسائية وأزياء الأطفال في عمان",
  description:
    "Shop women and kids fashion from Hala Dresses in Oman with direct WhatsApp support. تسوقي أزياء النساء والأطفال من هلا دريسز في عمان مع دعم مباشر عبر واتساب.",
  // other metadata
};

export default function HomePage() {
  return (
    <>
      <Home />
    </>
  );
}
