"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAppSelector } from "@/redux/store";
import { useSelector } from "react-redux";
import { selectTotalPrice } from "@/redux/features/cart-slice";
import { useCartModalContext } from "@/app/context/CartSidebarModalContext";
import { useLanguage } from "@/app/context/LanguageContext";
import { fetchCategories, StoreCategory } from "@/lib/storefront";
import { fetchNavigation, mapNavToMenu, DEFAULT_NAV_ITEMS } from "@/lib/navigation";
import CustomSelect from "./CustomSelect";
import Dropdown from "./Dropdown";
import LanguageDropdown from "./LanguageDropdown";

const Header = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sticky, setSticky] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [dbCategories, setDbCategories] = useState<StoreCategory[]>([]);
  const [navItems, setNavItems] = useState(DEFAULT_NAV_ITEMS);
  const [user, setUser] = useState<{ nameEn?: string | null; nameAr?: string | null; email: string; role: string } | null>(null);
  const { openCartModal } = useCartModalContext();
  const { language, isArabic } = useLanguage();
  const router = useRouter();
  const cartItems = useAppSelector((s) => s.cartReducer.items);
  const totalPrice = useSelector(selectTotalPrice);
  const menuData = mapNavToMenu(navItems, language);

  useEffect(() => {
    const controller = new AbortController();
    fetchNavigation(controller.signal).then(setNavItems).catch(() => setNavItems(DEFAULT_NAV_ITEMS));
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const onScroll = () => setSticky(window.scrollY >= 60);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchCategories({ language, parentOnly: true, signal: controller.signal })
      .then((cats) => setDbCategories(cats))
      .catch(() => setDbCategories([]));
    return () => controller.abort();
  }, [language]);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setUser(d.data);
        else setUser(null);
      })
      .catch(() => setUser(null));
  }, []);

  const dashboardHref = user
    ? user.role === "SELLER"
      ? "/seller"
      : user.role === "SUPER_ADMIN" || user.role === "ADMIN" || user.role === "STAFF"
        ? "/admin"
        : "/my-account"
    : "/signin";

  const accountLabel = user
    ? isArabic
      ? user.nameAr || user.nameEn || user.email
      : user.nameEn || user.email
    : null;

  const copy = isArabic
    ? {
        options: [
          { label: "كل التشكيلات", value: "0" },
          { label: "وصل حديثاً للنساء", value: "1" },
          { label: "تشكيلة البنات", value: "2" },
          { label: "تشكيلة الأطفال", value: "3" },
          { label: "ملابس المناسبات", value: "4" },
          { label: "الأطقم اليومية", value: "5" },
          { label: "الإكسسوارات", value: "6" },
          { label: "التخفيضات", value: "7" },
        ],
        search: "ابحثي عن أزياء...",
        login: "تسجيل الدخول",
        loginSub: "حسابي",
        dashboard: "لوحة التحكم",
        dashboardSub: "دخول نشط",
        cart: "السلة",
        wishlist: "المفضلة",
        recent: "شوهد مؤخراً",
        currency: "ر.ع.",
      }
    : {
        options: [
          { label: "All Collections", value: "0" },
          { label: "Women New In", value: "1" },
          { label: "Girls Collection", value: "2" },
          { label: "Baby Collection", value: "3" },
          { label: "Party Wear", value: "4" },
          { label: "Everyday Sets", value: "5" },
          { label: "Accessories", value: "6" },
          { label: "Sale", value: "7" },
        ],
        search: "Search styles...",
        login: "Log In",
        loginSub: "Account",
        dashboard: "Dashboard",
        dashboardSub: "Signed in",
        cart: "Cart",
        wishlist: "Wishlist",
        recent: "Recently Viewed",
        currency: "OMR",
      };

  const allLabel = isArabic ? "كل التشكيلات" : "All Collections";
  const categoryOptions =
    dbCategories.length > 0
      ? [
          { label: allLabel, value: "" },
          ...dbCategories.map((c) => ({ label: c.title, value: c.slug })),
        ]
      : copy.options;

  const handleCategorySelect = (option: { label: string; value: string }) => {
    router.push(
      option.value
        ? `/shop?category=${encodeURIComponent(option.value)}`
        : "/shop"
    );
  };

  return (
    <header
      dir={isArabic ? "rtl" : "ltr"}
      className={`fixed top-0 left-0 w-full z-9999 bg-white transition-shadow duration-300 ${sticky ? "shadow-md" : "shadow-sm"}`}
    >
      {/* ── Main Row ── */}
      <div className="max-w-[1170px] mx-auto px-4 sm:px-6 xl:px-0">
        <div className={`flex items-center gap-4 ${sticky ? "py-3" : "py-4"} transition-all duration-200`}>

          {/* Logo */}
          <Link href="/" className="flex-shrink-0">
            <Image src="/logo.svg" alt="Hala Dresses" width={40} height={40} priority />
          </Link>

          {/* Search — hidden on mobile, visible md+ */}
          <div className="hidden md:flex flex-1 min-w-0">
            <div className="flex w-full max-w-[520px]">
              <CustomSelect options={categoryOptions} onChange={handleCategorySelect} />
              <div className="relative flex-1">
                <span className={`absolute top-1/2 -translate-y-1/2 w-px h-5 bg-gray-3 ${isArabic ? "right-0" : "left-0"}`} />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  type="search"
                  placeholder={copy.search}
                  dir={isArabic ? "rtl" : "ltr"}
                  autoComplete="off"
                  className={`w-full bg-gray-1 border border-gray-3 py-2.5 text-sm outline-none focus:border-blue transition-colors ${
                    isArabic
                      ? "rounded-l-[5px] border-r-0 pr-4 pl-10"
                      : "rounded-r-[5px] border-l-0 pl-4 pr-10"
                  }`}
                />
                <button
                  aria-label="search"
                  className={`absolute top-1/2 -translate-y-1/2 text-dark-4 hover:text-blue transition-colors ${isArabic ? "left-3" : "right-3"}`}
                >
                  <svg className="fill-current" width="16" height="16" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M17.2687 15.6656L12.6281 11.8969C14.5406 9.28123 14.3437 5.5406 11.9531 3.1781C10.6875 1.91248 8.99995 1.20935 7.19995 1.20935C5.39995 1.20935 3.71245 1.91248 2.44683 3.1781C-0.168799 5.79373 -0.168799 10.0687 2.44683 12.6844C3.71245 13.95 5.39995 14.6531 7.19995 14.6531C8.91558 14.6531 10.5187 14.0062 11.7843 12.8531L16.4812 16.65C16.5937 16.7344 16.7343 16.7906 16.875 16.7906C17.0718 16.7906 17.2406 16.7062 17.3531 16.5656C17.5781 16.2844 17.55 15.8906 17.2687 15.6656ZM7.19995 13.3875C5.73745 13.3875 4.38745 12.825 3.34683 11.7844C1.20933 9.64685 1.20933 6.18748 3.34683 4.0781C4.38745 3.03748 5.73745 2.47498 7.19995 2.47498C8.66245 2.47498 10.0125 3.03748 11.0531 4.0781C13.1906 6.2156 13.1906 9.67498 11.0531 11.7844C10.0406 12.825 8.66245 13.3875 7.19995 13.3875Z" fill="" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-1 sm:gap-3 ms-auto">

            {/* Language switcher — desktop */}
            <div className="hidden sm:flex">
              <LanguageDropdown />
            </div>

            <div className="hidden sm:block w-px h-6 bg-gray-3 mx-1" />

            {/* Account */}
            <Link href={dashboardHref} className="hidden sm:flex items-center gap-2 group rounded-full px-1.5 py-1 transition-colors hover:bg-blue/5">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${user ? "bg-gradient-to-br from-blue to-blue-dark text-white group-hover:brightness-105" : "bg-blue/10 text-blue group-hover:bg-blue/20"}`}>
                {user ? (
                  <span className="text-xs font-semibold uppercase">
                    {(accountLabel || user.email).trim().charAt(0)}
                  </span>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path fillRule="evenodd" clipRule="evenodd" d="M12 1.25C9.37666 1.25 7.25001 3.37665 7.25001 6C7.25001 8.62335 9.37666 10.75 12 10.75C14.6234 10.75 16.75 8.62335 16.75 6C16.75 3.37665 14.6234 1.25 12 1.25ZM8.75001 6C8.75001 4.20507 10.2051 2.75 12 2.75C13.7949 2.75 15.25 4.20507 15.25 6C15.25 7.79493 13.7949 9.25 12 9.25C10.2051 9.25 8.75001 7.79493 8.75001 6Z" fill="currentColor"/>
                    <path fillRule="evenodd" clipRule="evenodd" d="M12 12.25C9.68646 12.25 7.55494 12.7759 5.97546 13.6643C4.4195 14.5396 3.25001 15.8661 3.25001 17.5L3.24995 17.602C3.24882 18.7638 3.2474 20.222 4.52642 21.2635C5.15589 21.7761 6.03649 22.1406 7.22622 22.3815C8.41927 22.6229 9.97424 22.75 12 22.75C14.0258 22.75 15.5808 22.6229 16.7738 22.3815C17.9635 22.1406 18.8441 21.7761 19.4736 21.2635C20.7526 20.222 20.7512 18.7638 20.7501 17.602L20.75 17.5C20.75 15.8661 19.5805 14.5396 18.0246 13.6643C16.4451 12.7759 14.3136 12.25 12 12.25ZM4.75001 17.5C4.75001 16.6487 5.37139 15.7251 6.71085 14.9717C8.02681 14.2315 9.89529 13.75 12 13.75C14.1047 13.75 15.9732 14.2315 17.2892 14.9717C18.6286 15.7251 19.25 16.6487 19.25 17.5C19.25 18.8078 19.2097 19.544 18.5264 20.1004C18.1559 20.4022 17.5365 20.6967 16.4762 20.9113C15.4193 21.1252 13.9742 21.25 12 21.25C10.0258 21.25 8.58075 21.1252 7.5238 20.9113C6.46354 20.6967 5.84413 20.4022 5.4736 20.1004C4.79033 19.544 4.75001 18.8078 4.75001 17.5Z" fill="currentColor"/>
                  </svg>
                )}
              </div>
              <div className="hidden lg:block">
                <p className="text-2xs text-dark-4 leading-none mb-0.5">{user ? copy.dashboardSub : copy.loginSub}</p>
                <p className="text-xs font-semibold text-dark leading-none">{user ? copy.dashboard : copy.login}</p>
              </div>
            </Link>

            {/* Cart */}
            <button onClick={openCartModal} className="flex items-center gap-2 group">
              <div className="relative w-8 h-8 rounded-full bg-blue/10 flex items-center justify-center group-hover:bg-blue/20 transition-colors text-blue">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4H6z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
                  <line x1="3" y1="6" x2="21" y2="6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
                  <path d="M16 10a4 4 0 01-8 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {cartItems.length > 0 && (
                  <span className="absolute -top-1 -end-1 w-4 h-4 rounded-full bg-blue text-white text-2xs font-bold flex items-center justify-center">
                    {cartItems.length}
                  </span>
                )}
              </div>
              <div className="hidden lg:block">
                <p className="text-2xs text-dark-4 leading-none mb-0.5">{copy.cart}</p>
                <p className="text-xs font-semibold text-dark leading-none">
                  {totalPrice.toFixed(3)} {copy.currency}
                </p>
              </div>
            </button>

            {/* Hamburger — mobile only */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="menu"
              className="xl:hidden flex flex-col justify-center items-center w-8 h-8 gap-1.5"
            >
              <span className={`block w-5 h-0.5 bg-dark rounded transition-all duration-300 ${mobileOpen ? "rotate-45 translate-y-2" : ""}`} />
              <span className={`block w-5 h-0.5 bg-dark rounded transition-all duration-300 ${mobileOpen ? "opacity-0" : ""}`} />
              <span className={`block w-5 h-0.5 bg-dark rounded transition-all duration-300 ${mobileOpen ? "-rotate-45 -translate-y-2" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Nav Row ── */}
      <div className="border-t border-gray-3">
        <div className="max-w-[1170px] mx-auto px-4 sm:px-6 xl:px-0">
          <div className="hidden xl:flex items-center justify-between">
            {/* Nav links */}
            <nav>
              <ul className="flex items-center">
                {menuData.map((item, i) =>
                  item.submenu ? (
                    <Dropdown key={i} menuItem={item} stickyMenu={sticky} />
                  ) : (
                    <li key={i} className="group relative before:absolute before:bottom-0 before:start-0 before:w-0 before:h-[2px] before:bg-blue before:transition-all before:duration-200 hover:before:w-full">
                      <Link
                        href={item.path}
                        className={`block font-medium text-sm text-dark hover:text-blue px-5 ${sticky ? "py-3" : "py-4"} transition-colors`}
                      >
                        {item.title}
                      </Link>
                    </li>
                  )
                )}
              </ul>
            </nav>

            {/* Nav right */}
            <div className="flex items-center gap-5">
              <Link href="/wishlist" className="flex items-center gap-1.5 text-sm text-dark-4 hover:text-blue transition-colors py-4">
                <svg className="fill-current" width="15" height="15" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M5.97441 12.6073L6.43872 12.0183L5.97441 12.6073ZM7.99992 3.66709L7.45955 4.18719C7.60094 4.33408 7.79604 4.41709 7.99992 4.41709C8.2038 4.41709 8.3989 4.33408 8.54028 4.18719L7.99992 3.66709ZM10.0254 12.6073L10.4897 13.1962L10.0254 12.6073ZM6.43872 12.0183C5.41345 11.21 4.33627 10.4524 3.47904 9.48717C2.64752 8.55085 2.08325 7.47831 2.08325 6.0914H0.583252C0.583252 7.94644 1.3588 9.35867 2.35747 10.4832C3.33043 11.5788 4.57383 12.4582 5.51009 13.1962L6.43872 12.0183ZM2.08325 6.0914C2.08325 4.75102 2.84027 3.63995 3.85342 3.17683C4.81929 2.73533 6.15155 2.82823 7.45955 4.18719L8.54028 3.14699C6.84839 1.38917 4.84732 1.07324 3.22983 1.8126C1.65962 2.53035 0.583252 4.18982 0.583252 6.0914H2.08325ZM5.51009 13.1962C5.84928 13.4636 6.22932 13.7618 6.61834 13.9891C7.00711 14.2163 7.47619 14.4167 7.99992 14.4167V12.9167C7.85698 12.9167 7.65939 12.8601 7.37512 12.694C7.0911 12.5281 6.79171 12.2965 6.43872 12.0183L5.51009 13.1962ZM10.4897 13.1962C11.426 12.4582 12.6694 11.5788 13.6424 10.4832C14.641 9.35867 15.4166 7.94644 15.4166 6.0914H13.9166C13.9166 7.47831 13.3523 8.55085 12.5208 9.48717C11.6636 10.4524 10.5864 11.21 9.56112 12.0183L10.4897 13.1962ZM15.4166 6.0914C15.4166 4.18982 14.3402 2.53035 12.77 1.8126C11.1525 1.07324 9.15145 1.38917 7.45955 3.14699L8.54028 4.18719C9.84828 2.82823 11.1805 2.73533 12.1464 3.17683C13.1596 3.63995 13.9166 4.75102 13.9166 6.0914H15.4166ZM9.56112 12.0183C9.20813 12.2965 8.90874 12.5281 8.62471 12.694C8.34044 12.8601 8.14285 12.9167 7.99992 12.9167V14.4167C8.52365 14.4167 8.99273 14.2163 9.3815 13.9891C9.77052 13.7618 10.1506 13.4636 10.4897 13.1962L9.56112 12.0183Z" fill=""/>
                </svg>
                {copy.wishlist}
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ── Mobile Menu ── */}
      <div className={`xl:hidden border-t border-gray-3 bg-white overflow-hidden transition-all duration-300 ease-in-out ${mobileOpen ? "max-h-screen" : "max-h-0"}`}>
        <div className="max-w-[1170px] mx-auto px-4 sm:px-6 py-4 flex flex-col gap-4">

          {/* Mobile search — only shown on screens where it's not in the top bar */}
          <div className="md:hidden flex">
            <CustomSelect options={categoryOptions} onChange={handleCategorySelect} />
            <div className="relative flex-1">
              <span className={`absolute top-1/2 -translate-y-1/2 w-px h-5 bg-gray-3 ${isArabic ? "right-0" : "left-0"}`} />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                type="search"
                placeholder={copy.search}
                dir={isArabic ? "rtl" : "ltr"}
                autoComplete="off"
                className={`w-full bg-gray-1 border border-gray-3 py-2.5 text-sm outline-none focus:border-blue transition-colors ${
                  isArabic ? "rounded-l-[5px] border-r-0 pr-4 pl-10" : "rounded-r-[5px] border-l-0 pl-4 pr-10"
                }`}
              />
              <button aria-label="search" className={`absolute top-1/2 -translate-y-1/2 text-dark-4 ${isArabic ? "left-3" : "right-3"}`}>
                <svg className="fill-current" width="16" height="16" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M17.2687 15.6656L12.6281 11.8969C14.5406 9.28123 14.3437 5.5406 11.9531 3.1781C10.6875 1.91248 8.99995 1.20935 7.19995 1.20935C5.39995 1.20935 3.71245 1.91248 2.44683 3.1781C-0.168799 5.79373 -0.168799 10.0687 2.44683 12.6844C3.71245 13.95 5.39995 14.6531 7.19995 14.6531C8.91558 14.6531 10.5187 14.0062 11.7843 12.8531L16.4812 16.65C16.5937 16.7344 16.7343 16.7906 16.875 16.7906C17.0718 16.7906 17.2406 16.7062 17.3531 16.5656C17.5781 16.2844 17.55 15.8906 17.2687 15.6656ZM7.19995 13.3875C5.73745 13.3875 4.38745 12.825 3.34683 11.7844C1.20933 9.64685 1.20933 6.18748 3.34683 4.0781C4.38745 3.03748 5.73745 2.47498 7.19995 2.47498C8.66245 2.47498 10.0125 3.03748 11.0531 4.0781C13.1906 6.2156 13.1906 9.67498 11.0531 11.7844C10.0406 12.825 8.66245 13.3875 7.19995 13.3875Z" fill=""/>
                </svg>
              </button>
            </div>
          </div>

          {/* Mobile nav links */}
          <nav>
            <ul className="flex flex-col gap-1">
              {menuData.map((item, i) => (
                <li key={i}>
                  <Link
                    href={item.path}
                    onClick={() => setMobileOpen(false)}
                    className="block py-2.5 px-1 text-sm font-medium text-dark hover:text-blue border-b border-gray-2 transition-colors"
                  >
                    {item.title}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Mobile bottom row */}
          <div className="flex items-center justify-between pt-1">
            <LanguageDropdown />
            <Link
              href={dashboardHref}
              onClick={() => setMobileOpen(false)}
              className={`text-sm font-medium transition-colors ${user ? "inline-flex items-center rounded-full bg-blue text-white px-4 py-2 hover:bg-blue-dark" : "text-blue hover:underline"}`}
            >
              {user ? copy.dashboard : copy.login}
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
