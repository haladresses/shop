"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAppSelector } from "@/redux/store";
import { useCartModalContext } from "@/app/context/CartSidebarModalContext";
import { useLanguage } from "@/app/context/LanguageContext";

/**
 * App-style bottom bar for phones/tablets: Home · Shop · Search · Wishlist ·
 * Cart. Its wishlist and cart icons are also the landing spots for the
 * add-to-wishlist / add-to-cart flight animations on small screens.
 * Hides while scrolling down and returns on scroll up, like native apps.
 */
export default function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { isArabic } = useLanguage();
  const { openCartModal } = useCartModalContext();
  const cartCount = useAppSelector((s) => s.cartReducer.items.reduce((n, i) => n + i.quantity, 0));
  const wishCount = useAppSelector((s) => s.wishlistReducer.items.length);
  const [hidden, setHidden] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [q, setQ] = useState("");
  const lastY = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      const delta = y - lastY.current;
      if (Math.abs(delta) > 8) setHidden(delta > 0 && y > 200);
      lastY.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (searchOpen) setTimeout(() => inputRef.current?.focus(), 50);
  }, [searchOpen]);

  // The product page has its own sticky buy bar.
  if (pathname?.startsWith("/shop-details")) return null;

  const t = (en: string, ar: string) => (isArabic ? ar : en);
  const active = (p: string) => (p === "/" ? pathname === "/" : pathname?.startsWith(p));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    setSearchOpen(false);
    router.push(term ? `/shop?search=${encodeURIComponent(term)}` : "/shop");
  };

  const item = "relative flex flex-col items-center justify-center gap-0.5 flex-1 h-full text-[10.5px] font-medium transition-colors";

  return (
    <>
      <nav
        aria-label={t("Quick navigation", "تنقل سريع")}
        className={`lg:hidden fixed inset-x-0 bottom-0 z-[9990] bg-white/95 backdrop-blur-md border-t border-gray-3 pb-[env(safe-area-inset-bottom)] transition-transform duration-300 ${hidden && !searchOpen ? "translate-y-full" : ""}`}
      >
        <div className="flex items-stretch h-16 max-w-[560px] mx-auto">
          <Link href="/" className={`${item} ${active("/") ? "text-blue" : "text-dark-4"}`}>
            <Icon d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1h-5v-6h-6v6H4a1 1 0 01-1-1v-9.5z" active={!!active("/")} />
            {t("Home", "الرئيسية")}
          </Link>
          <Link href="/shop" className={`${item} ${active("/shop") && !searchOpen ? "text-blue" : "text-dark-4"}`}>
            <Icon d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" active={!!active("/shop")} />
            {t("Shop", "المتجر")}
          </Link>
          <button onClick={() => setSearchOpen(true)} className={`${item} ${searchOpen ? "text-blue" : "text-dark-4"}`}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden><circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" /><path d="M16 16l4.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
            {t("Search", "بحث")}
          </button>
          <Link href="/wishlist" className={`${item} ${active("/wishlist") ? "text-blue" : "text-dark-4"}`}>
            <span data-fx-target="wishlist" className="relative">
              <Icon d="M12 20.5s-7-4.3-9-8.7C1.6 8.7 3.4 5 7 5c2 0 3.3 1.1 4.1 2.2C11.9 6.1 13.2 5 15.2 5c3.6 0 5.4 3.7 4 6.8-2 4.4-7.2 8.7-7.2 8.7z" active={!!active("/wishlist")} />
              <Badge n={wishCount} />
            </span>
            {t("Wishlist", "المفضلة")}
          </Link>
          <button onClick={openCartModal} className={`${item} text-dark-4`}>
            <span data-fx-target="cart" className="relative">
              <Icon d="M6 7h12l-1 13H7L6 7zM9 7V6a3 3 0 016 0v1" active={false} />
              <Badge n={cartCount} />
            </span>
            {t("Cart", "السلة")}
          </button>
        </div>
      </nav>

      {searchOpen && (
        <div className="lg:hidden fixed inset-0 z-[99980]" dir={isArabic ? "rtl" : "ltr"}>
          <div className="absolute inset-0 bg-dark/40 qa-fade" onClick={() => setSearchOpen(false)} />
          <form onSubmit={submit} className="absolute inset-x-0 top-0 bg-white p-4 shadow-xl qa-fade">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="absolute start-3.5 top-1/2 -translate-y-1/2 text-dark-4" aria-hidden>
                  <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
                  <path d="M16 16l4.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
                <input
                  ref={inputRef}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  type="search"
                  enterKeyHint="search"
                  placeholder={t("Search dresses, sets, colours…", "ابحثي عن فساتين، أطقم، ألوان…")}
                  className="w-full h-12 rounded-full bg-gray-1 border border-gray-3 ps-11 pe-4 text-[16px] outline-none focus:border-blue"
                />
              </div>
              <button type="button" onClick={() => setSearchOpen(false)} className="px-2 text-sm text-dark-4">
                {t("Cancel", "إلغاء")}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

function Icon({ d, active }: { d: string; active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
      <path d={d} fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.14 : 0} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function Badge({ n }: { n: number }) {
  if (n <= 0) return null;
  return (
    <span key={n} className="fx-badge-pop absolute -top-1.5 -end-2.5 min-w-[17px] h-[17px] px-1 rounded-full bg-blue text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white">
      {n > 99 ? "99+" : n}
    </span>
  );
}
