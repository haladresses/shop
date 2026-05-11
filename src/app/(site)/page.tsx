import Home from "@/components/Home";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Hala Dresses | Women and kids fashion retail in Oman",
  description: "Shop women and kids fashion from Hala Dresses in Oman, with curated retail collections and direct WhatsApp support.",
  // other metadata
};

export default function HomePage() {
  return (
    <>
      <Home />
    </>
  );
}
