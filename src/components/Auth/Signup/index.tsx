"use client";
import AuthShell, { AuthError, AuthField, AuthSubmit, PasswordField } from "@/components/Auth/AuthShell";
import { useLanguage } from "@/app/context/LanguageContext";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

const Signup = () => {
  const router = useRouter();
  const { isArabic } = useLanguage();
  const [form, setForm] = useState({ nameEn: "", identifier: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const copy = isArabic
    ? {
        breadcrumb: "إنشاء حساب",
        title: "أنشئي حسابك",
        subtitle: "دقيقة واحدة فقط — لمتابعة الطلبات وحفظ المفضلة.",
        quote: "إطلالات تليق بكل مناسبة.",
        show: "إظهار كلمة المرور",
        hide: "إخفاء كلمة المرور",
        strength: ["ضعيفة", "مقبولة", "جيدة", "قوية"],
        match: "متطابقة",
        name: "الاسم الكامل",
        namePlaceholder: "أدخلي اسمك الكامل",
        email: "البريد الإلكتروني أو رقم الجوال",
        emailPlaceholder: "مثال: 9944 0312 أو name@email.com",
        emailHint: "يكفي واحد منهما",
        password: "كلمة المرور",
        passwordPlaceholder: "6 أحرف على الأقل",
        confirmPassword: "تأكيد كلمة المرور",
        confirmPasswordPlaceholder: "أعيدي إدخال كلمة المرور",
        submit: "إنشاء الحساب",
        submitting: "جارٍ إنشاء الحساب...",
        haveAccount: "لديك حساب بالفعل؟",
        signin: "سجلي الدخول الآن",
        passwordMismatch: "كلمتا المرور غير متطابقتين",
        passwordMin: "يجب أن تكون كلمة المرور 6 أحرف على الأقل",
        failed: "حدث خطأ ما. يرجى المحاولة مرة أخرى.",
        registerFailed: "فشل إنشاء الحساب",
      }
    : {
        breadcrumb: "Sign Up",
        title: "Create your account",
        subtitle: "It takes a minute — track orders and save favourites.",
        quote: "Looks made for every occasion.",
        show: "Show password",
        hide: "Hide password",
        strength: ["Weak", "Fair", "Good", "Strong"],
        match: "Matches",
        name: "Full Name",
        namePlaceholder: "Enter your full name",
        email: "Email or mobile number",
        emailPlaceholder: "e.g. 9944 0312 or name@email.com",
        emailHint: "Either one is fine",
        password: "Password",
        passwordPlaceholder: "At least 6 characters",
        confirmPassword: "Re-type Password",
        confirmPasswordPlaceholder: "Re-enter your password",
        submit: "Create Account",
        submitting: "Creating account...",
        haveAccount: "Already have an account?",
        signin: "Sign in",
        passwordMismatch: "Passwords do not match",
        passwordMin: "Password must be at least 6 characters",
        failed: "Something went wrong. Please try again.",
        registerFailed: "Registration failed",
      };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (form.password.length < 6) {
      setError(copy.passwordMin);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nameEn: form.nameEn, identifier: form.identifier, password: form.password }),
      });

      const data = await res.json();
      if (!data.success) {
        setError(data.error || copy.registerFailed);
        return;
      }

      const next = new URLSearchParams(window.location.search).get("next");
      router.push(next && next.startsWith("/") && !next.startsWith("//") ? next : "/my-account");
    } catch {
      setError(copy.failed);
    } finally {
      setLoading(false);
    }
  };

  // 0–4 strength score: length, mixed case, digits, symbols.
  const pw = form.password;
  const score = !pw
    ? 0
    : Math.min(4, (pw.length >= 6 ? 1 : 0) + (/[a-z]/.test(pw) && /[A-Z]/.test(pw) ? 1 : 0) + (/\d/.test(pw) ? 1 : 0) + (/[^A-Za-z0-9]/.test(pw) || pw.length >= 12 ? 1 : 0));
  const STRENGTH_COLORS = ["#F23030", "#F59E0B", "#3B82F6", "#16A34A"];

  return (
    <AuthShell
      title={copy.title}
      subtitle={copy.subtitle}
      quote={copy.quote}
      footer={
        <>
          {copy.haveAccount}{" "}
          <Link href="/signin" className="font-semibold text-dark underline underline-offset-4 decoration-dark/30 hover:decoration-dark">
            {copy.signin}
          </Link>
        </>
      }
    >
      <AuthError message={error} />
      <form onSubmit={handleSubmit} className="space-y-5">
        <AuthField
          label={copy.name}
          name="name"
          autoComplete="name"
          placeholder={copy.namePlaceholder}
          value={form.nameEn}
          onChange={(e) => setForm({ ...form, nameEn: e.target.value })}
          required
          autoFocus
        />
        <AuthField
          label={copy.email}
          type="text"
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder={copy.emailPlaceholder}
          hint={<span className="text-xs font-normal text-dark-4">{copy.emailHint}</span>}
          value={form.identifier}
          onChange={(e) => setForm({ ...form, identifier: e.target.value })}
          required
          dir="ltr"
        />
        <div>
          <PasswordField
            label={copy.password}
            name="new-password"
            autoComplete="new-password"
            placeholder={copy.passwordPlaceholder}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
            minLength={6}
            dir="ltr"
            showLabel={copy.show}
            hideLabel={copy.hide}
            hint={pw ? <span className="text-xs font-medium" style={{ color: STRENGTH_COLORS[Math.max(0, score - 1)] }}>{copy.strength[Math.max(0, score - 1)]}</span> : undefined}
          />
          <div className="mt-2 grid grid-cols-4 gap-1.5" aria-hidden>
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className="h-1 rounded-full transition-colors duration-300" style={{ background: i < score ? STRENGTH_COLORS[score - 1] : "#E5E7EB" }} />
            ))}
          </div>
        </div>
        <div className="pt-2">
          <AuthSubmit loading={loading}>{loading ? copy.submitting : copy.submit}</AuthSubmit>
        </div>
      </form>
    </AuthShell>
  );
};

export default Signup;
