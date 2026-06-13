"use client";
import Breadcrumb from "@/components/Common/Breadcrumb";
import { useLanguage } from "@/app/context/LanguageContext";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

const Signup = () => {
  const router = useRouter();
  const { isArabic } = useLanguage();
  const [form, setForm] = useState({ nameEn: "", email: "", password: "", confirmPassword: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const copy = isArabic
    ? {
        breadcrumb: "إنشاء حساب",
        title: "أنشئي حساباً جديداً",
        subtitle: "أدخلي بياناتك لإنشاء حسابك بسهولة",
        name: "الاسم الكامل",
        namePlaceholder: "أدخلي اسمك الكامل",
        email: "البريد الإلكتروني",
        emailPlaceholder: "أدخلي بريدك الإلكتروني",
        password: "كلمة المرور",
        passwordPlaceholder: "8 أحرف على الأقل",
        confirmPassword: "تأكيد كلمة المرور",
        confirmPasswordPlaceholder: "أعيدي إدخال كلمة المرور",
        submit: "إنشاء الحساب",
        submitting: "جارٍ إنشاء الحساب...",
        haveAccount: "لديك حساب بالفعل؟",
        signin: "سجلي الدخول الآن",
        passwordMismatch: "كلمتا المرور غير متطابقتين",
        passwordMin: "يجب أن تكون كلمة المرور 8 أحرف على الأقل",
        failed: "حدث خطأ ما. يرجى المحاولة مرة أخرى.",
        registerFailed: "فشل إنشاء الحساب",
      }
    : {
        breadcrumb: "Sign Up",
        title: "Create an Account",
        subtitle: "Enter your details below",
        name: "Full Name",
        namePlaceholder: "Enter your full name",
        email: "Email Address",
        emailPlaceholder: "Enter your email address",
        password: "Password",
        passwordPlaceholder: "Min. 8 characters",
        confirmPassword: "Re-type Password",
        confirmPasswordPlaceholder: "Re-enter your password",
        submit: "Create Account",
        submitting: "Creating account...",
        haveAccount: "Already have an account?",
        signin: "Sign in Now",
        passwordMismatch: "Passwords do not match",
        passwordMin: "Password must be at least 8 characters",
        failed: "Something went wrong. Please try again.",
        registerFailed: "Registration failed",
      };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (form.password !== form.confirmPassword) {
      setError(copy.passwordMismatch);
      return;
    }
    if (form.password.length < 8) {
      setError(copy.passwordMin);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nameEn: form.nameEn, email: form.email, password: form.password }),
      });

      const data = await res.json();
      if (!data.success) {
        setError(data.error || copy.registerFailed);
        return;
      }

      router.push("/my-account");
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
                <label htmlFor="name" className="block mb-2.5 font-medium text-dark">
                  {copy.name} <span className="text-red">*</span>
                </label>
                <input
                  type="text"
                  id="name"
                  placeholder={copy.namePlaceholder}
                  value={form.nameEn}
                  onChange={(e) => setForm({ ...form, nameEn: e.target.value })}
                  required
                  minLength={2}
                  dir={isArabic ? "rtl" : "ltr"}
                  className="rounded-lg border border-gray-3 bg-gray-1 placeholder:text-dark-5 w-full py-3 px-5 outline-none duration-200 focus:border-transparent focus:shadow-input focus:ring-2 focus:ring-blue/20"
                />
              </div>

              <div className="mb-5">
                <label htmlFor="email" className="block mb-2.5 font-medium text-dark">
                  {copy.email} <span className="text-red">*</span>
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
                  {copy.password} <span className="text-red">*</span>
                </label>
                <input
                  type="password"
                  id="password"
                  placeholder={copy.passwordPlaceholder}
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                  dir={isArabic ? "rtl" : "ltr"}
                  className="rounded-lg border border-gray-3 bg-gray-1 placeholder:text-dark-5 w-full py-3 px-5 outline-none duration-200 focus:border-transparent focus:shadow-input focus:ring-2 focus:ring-blue/20"
                />
              </div>

              <div className="mb-5.5">
                <label htmlFor="confirmPassword" className="block mb-2.5 font-medium text-dark">
                  {copy.confirmPassword} <span className="text-red">*</span>
                </label>
                <input
                  type="password"
                  id="confirmPassword"
                  placeholder={copy.confirmPasswordPlaceholder}
                  autoComplete="new-password"
                  value={form.confirmPassword}
                  onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
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
                {copy.haveAccount}{" "}
                <Link href="/signin" className="text-dark ease-out duration-200 hover:text-blue font-medium">
                  {copy.signin}
                </Link>
              </p>
            </form>
          </div>
        </div>
      </section>
    </>
  );
};

export default Signup;
