import Signin from "@/components/Auth/Signin";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In | Hala Dresses",
  description: "Access your Hala Dresses account.",
};

export default function SigninPage() {
  return (
    <main>
      <Signin />
    </main>
  );
}
