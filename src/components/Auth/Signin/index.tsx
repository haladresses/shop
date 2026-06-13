"use client";
import Breadcrumb from "@/components/Common/Breadcrumb";
import { useLanguage } from "@/app/context/LanguageContext";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

const Signin = () => {
  const router = useRouter();
  const { isArabic } = useLanguage();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const copy = isArabic
    ? {
        breadcrumb: "تسجيل الدخول",
        title: "سجلي الدخول إلى حسابك",
        subtitle: "أدخلي بياناتك للمتابعة إلى حسابك",
        email: "البريد الإلكتروني",
        emailPlaceholder: "أدخلي بريدك الإلكتروني",
        password: "كلمة المرور",
        passwordPlaceholder: "أدخلي كلمة المرور",
        submit: "تسجيل الدخول",
        submitting: "جارٍ تسجيل الدخول...",
        noAccount: "ليس لديك حساب؟",
        signUp: "إنشاء حساب",
        invalid: "البريد الإلكتروني أو كلمة المرور غير صحيحة",
        failed: "حدث خطأ ما. يرجى المحاولة مرة أخرى.",
      }
    : {
        breadcrumb: "Sign In",
        title: "Sign In to Your Account",
        subtitle: "Enter your details below",
        email: "Email",
        emailPlaceholder: "Enter your email",
        password: "Password",
        passwordPlaceholder: "Enter your password",
        submit: "Sign in to account",
        submitting: "Signing in...",
        noAccount: "Don't have an account?",
        signUp: "Sign Up Now!",
        invalid: "Invalid email or password",
        failed: "Something went wrong. Please try again.",
      };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error || copy.invalid);
        return;
      }

      const role = data.data.user.role;
      if (role === "SUPER_ADMIN" || role === "ADMIN" || role === "STAFF") {
        router.push("/admin");
      } else if (role === "SELLER") {
        router.push("/seller");
      } else {
        router.push("/my-account");
      }
    } catch {
      setError(copy.failed);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Breadcrumb title={copy.breadcrumb} pages={[copy.breadcrumb]} />
      <section dir={isArabic ? "rtl" : "ltr"} className="overflow-hidden py-20 bg-gray-2">
        <div className="max-w-[1170px] w-full mx-auto px-4 sm:px-8 xl:px-0">
          <div className="max-w-[570px] w-full mx-auto rounded-xl bg-white shadow-1 p-4 sm:p-7.5 xl:p-11">
            <div className="text-center mb-11">
              <h2 className="font-semibold text-xl sm:text-2xl xl:text-heading-5 text-dark mb-1.5">
                {copy.title}
              </h2>
              <p className="text-dark-4">{copy.subtitle}</p>
            </div>

            {error && (
              <div className="mb-5 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="mb-5">
                <label htmlFor="email" className="block mb-2.5 font-medium text-dark">
                  {copy.email}
                </label>
                <input
                  type="email"
                  id="email"
                  placeholder={copy.emailPlaceholder}
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                  dir={isArabic ? "rtl" : "ltr"}
                  className="rounded-lg border border-gray-3 bg-gray-1 placeholder:text-dark-5 w-full py-3 px-5 outline-none duration-200 focus:border-transparent focus:shadow-input focus:ring-2 focus:ring-blue/20"
                />
              </div>

              <div className="mb-5">
                <label htmlFor="password" className="block mb-2.5 font-medium text-dark">
                  {copy.password}
                </label>
                <input
                  type="password"
                  id="password"
                  placeholder={copy.passwordPlaceholder}
                  autoComplete="current-password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                  dir={isArabic ? "rtl" : "ltr"}
                  className="rounded-lg border border-gray-3 bg-gray-1 placeholder:text-dark-5 w-full py-3 px-5 outline-none duration-200 focus:border-transparent focus:shadow-input focus:ring-2 focus:ring-blue/20"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center font-medium text-white bg-dark py-3 px-6 rounded-lg ease-out duration-200 hover:bg-blue mt-7.5 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? copy.submitting : copy.submit}
              </button>

              <p className="text-center mt-6 text-dark-4">
                {copy.noAccount}{" "}
                <Link href="/signup" className="text-dark ease-out duration-200 hover:text-blue font-medium">
                  {copy.signUp}
                </Link>
              </p>
            </form>
          </div>
        </div>
      </section>
    </>
  );
};

export default Signin;
