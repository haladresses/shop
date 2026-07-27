export type NavSubItem = {
  labelEn: string;
  labelAr: string;
  path: string;
  newTab: boolean;
};

export type NavItem = {
  labelEn: string;
  labelAr: string;
  path: string;
  newTab: boolean;
  submenu: NavSubItem[];
};

export const DEFAULT_NAV_ITEMS: NavItem[] = [
  { labelEn: "Home", labelAr: "الرئيسية", path: "/", newTab: false, submenu: [] },
  { labelEn: "Collections", labelAr: "التشكيلات", path: "/shop", newTab: false, submenu: [] },
  { labelEn: "Contact", labelAr: "اتصل بنا", path: "/contact", newTab: false, submenu: [] },
  {
    labelEn: "Client Area",
    labelAr: "حسابي",
    path: "/",
    newTab: false,
    submenu: [
      { labelEn: "Full Collection", labelAr: "كل التشكيلة", path: "/shop", newTab: false },
      { labelEn: "Special Picks", labelAr: "العروض الخاصة", path: "/shop-without-sidebar", newTab: false },
      { labelEn: "Checkout", labelAr: "الدفع", path: "/checkout", newTab: false },
      { labelEn: "Shopping Bag", labelAr: "سلة التسوق", path: "/cart", newTab: false },
      { labelEn: "Wishlist", labelAr: "المفضلة", path: "/wishlist", newTab: false },
      { labelEn: "Client Login", labelAr: "تسجيل الدخول", path: "/signin", newTab: false },
      { labelEn: "Create Account", labelAr: "إنشاء حساب", path: "/signup", newTab: false },
      { labelEn: "My Account", labelAr: "حسابي", path: "/my-account", newTab: false },
    ],
  },
  {
    labelEn: "Journal",
    labelAr: "المدونة",
    path: "/",
    newTab: false,
    submenu: [
      { labelEn: "Journal With Sidebar", labelAr: "المدونة مع الشريط الجانبي", path: "/blogs/blog-grid-with-sidebar", newTab: false },
      { labelEn: "Journal Grid", labelAr: "شبكة المدونة", path: "/blogs/blog-grid", newTab: false },
      { labelEn: "Journal Story With Sidebar", labelAr: "تفاصيل المقال مع الشريط", path: "/blogs/blog-details-with-sidebar", newTab: false },
      { labelEn: "Journal Story", labelAr: "تفاصيل المقال", path: "/blogs/blog-details", newTab: false },
    ],
  },
];

export const NAV_MENU_KEY = "nav_menu";

const str = (v: unknown, fallback = ""): string =>
  typeof v === "string" ? v : v == null ? fallback : String(v);

function normalizeSubItem(raw: unknown): NavSubItem {
  const o = (raw ?? {}) as Record<string, unknown>;
  return {
    labelEn: str(o.labelEn),
    labelAr: str(o.labelAr),
    path: str(o.path, "/") || "/",
    newTab: Boolean(o.newTab),
  };
}

function normalizeItem(raw: unknown): NavItem {
  const o = (raw ?? {}) as Record<string, unknown>;
  const submenu = Array.isArray(o.submenu)
    ? o.submenu.map(normalizeSubItem).filter((s) => s.labelEn || s.labelAr)
    : [];
  return {
    labelEn: str(o.labelEn),
    labelAr: str(o.labelAr),
    path: str(o.path, "/") || "/",
    newTab: Boolean(o.newTab),
    submenu,
  };
}

/** Coerce an unknown value (from the settings store) into a typed nav menu array. */
export function normalizeNavItems(raw: unknown): NavItem[] {
  if (!Array.isArray(raw) || raw.length === 0) return DEFAULT_NAV_ITEMS;
  return raw.map(normalizeItem).filter((i) => i.labelEn || i.labelAr);
}

/** Fetch the header navigation menu from the public API (client-side). */
export async function fetchNavigation(signal?: AbortSignal): Promise<NavItem[]> {
  try {
    const res = await fetch("/api/navigation", { signal });
    const json = await res.json();
    if (!json.success) return DEFAULT_NAV_ITEMS;
    return normalizeNavItems(json.data?.items);
  } catch {
    return DEFAULT_NAV_ITEMS;
  }
}

import type { Menu } from "@/types/Menu";

/** Resolve a bilingual nav item array into the localized shape used by the header UI. */
export function mapNavToMenu(items: NavItem[], language: "en" | "ar"): Menu[] {
  const isArabic = language === "ar";
  return items.map((item, i) => ({
    id: i + 1,
    title: (isArabic ? item.labelAr : item.labelEn) || item.labelEn || item.labelAr,
    path: item.path,
    newTab: item.newTab,
    submenu: item.submenu.length
      ? item.submenu.map((s, j) => ({
          id: (i + 1) * 100 + j,
          title: (isArabic ? s.labelAr : s.labelEn) || s.labelEn || s.labelAr,
          path: s.path,
          newTab: s.newTab,
        }))
      : undefined,
  }));
}
