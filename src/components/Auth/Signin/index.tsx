"use client";
import AuthShell, { AuthError, AuthField, AuthSubmit, PasswordField } from "@/components/Auth/AuthShell";
import { useLanguage } from "@/app/context/LanguageContext";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

const Signin = () => {
  const router = useRouter();
  const { isArabic } = useLanguage();
  const [form, setForm] = useState({ identifier: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const copy = isArabic
    ? {
        breadcrumb: "تسجيل الدخول",
        title: "أهلاً بعودتك",
        subtitle: "سجلي الدخول لمتابعة طلباتك ومفضلتك.",
        quote: "أناقة مختارة بعناية، لكِ ولصغيرتكِ.",
        show: "إظهار كلمة المرور",
        hide: "إخفاء كلمة المرور",
        email: "البريد الإلكتروني أو رقم الجوال",
        emailPlaceholder: "مثال: 9944 0312 أو name@email.com",
        password: "كلمة المرور",
        passwordPlaceholder: "أدخلي كلمة المرور",
        submit: "تسجيل الدخول",
        submitting: "جارٍ تسجيل الدخول...",
        noAccount: "ليس لديك حساب؟",
        signUp: "أنشئي حساباً",
        invalid: "البريد/الجوال أو كلمة المرور غير صحيحة",
        failed: "حدث خطأ ما. يرجى المحاولة مرة أخرى.",
      }
    : {
        breadcrumb: "Sign In",
        title: "Welcome back",
        subtitle: "Sign in to track orders and see your wishlist.",
        quote: "Beautifully curated fashion, for you and your little one.",
        show: "Show password",
        hide: "Hide password",
        email: "Email or mobile number",
        emailPlaceholder: "e.g. 9944 0312 or name@email.com",
        password: "Password",
        passwordPlaceholder: "Enter your password",
        submit: "Sign in",
        submitting: "Signing in...",
        noAccount: "Don't have an account?",
        signUp: "Create one",
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

      const permissions: string[] = data.data.user.permissions || [];
      if (permissions.includes("panel.admin.access")) {
        router.push("/admin");
      } else if (permissions.includes("panel.seller.access")) {
        router.push("/seller");
      } else {
        // Return to where the shopper came from (e.g. checkout), if safe.
        const next = new URLSearchParams(window.location.search).get("next");
        router.push(next && next.startsWith("/") && !next.startsWith("//") ? next : "/my-account");
      }
    } catch {
      setError(copy.failed);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title={copy.title}
      subtitle={copy.subtitle}
      quote={copy.quote}
      footer={
        <>
          {copy.noAccount}{" "}
          <Link href="/signup" className="font-semibold text-dark underline underline-offset-4 decoration-dark/30 hover:decoration-dark">
            {copy.signUp}
          </Link>
        </>
      }
    >
      <AuthError message={error} />
      <form onSubmit={handleSubmit} className="space-y-5" noValidate={false}>
        <AuthField
          label={copy.email}
          type="text"
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder={copy.emailPlaceholder}
          value={form.identifier}
          onChange={(e) => setForm({ ...form, identifier: e.target.value })}
          required
          autoFocus
          dir="ltr"
        />
        <PasswordField
          label={copy.password}
          name="password"
          autoComplete="current-password"
          placeholder={copy.passwordPlaceholder}
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          required
          dir="ltr"
          showLabel={copy.show}
          hideLabel={copy.hide}
        />
        <div className="pt-2">
          <AuthSubmit loading={loading}>{loading ? copy.submitting : copy.submit}</AuthSubmit>
        </div>
      </form>
    </AuthShell>
  );
};

export default Signin;
