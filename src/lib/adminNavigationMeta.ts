import type { IconType } from "react-icons";
import {
  LuCreditCard,
  LuGalleryHorizontalEnd,
  LuImage,
  LuInfo,
  LuLayoutDashboard,
  LuMail,
  LuMenu,
  LuPackage,
  LuQuote,
  LuScale,
  LuSettings,
  LuShield,
  LuShirt,
  LuStar,
  LuTags,
  LuTicket,
  LuTimer,
  LuTruck,
  LuUsers,
  LuWarehouse,
} from "react-icons/lu";

export type AdminNavigationSection = "Overview" | "Operations" | "Catalog" | "Content" | "System";

export type AdminNavigationMeta = {
  href: string;
  label: string;
  permission: string;
  section: AdminNavigationSection;
  icon: IconType;
  color: string;
  exact?: boolean;
};

export const ADMIN_NAVIGATION_META: AdminNavigationMeta[] = [
  { href: "/admin", label: "Dashboard", permission: "admin.dashboard.view", section: "Overview", icon: LuLayoutDashboard, color: "text-sky-400", exact: true },
  { href: "/admin/orders", label: "Orders", permission: "admin.orders.view", section: "Operations", icon: LuPackage, color: "text-amber-400" },
  { href: "/admin/payments", label: "Payments", permission: "admin.payments.view", section: "Operations", icon: LuCreditCard, color: "text-green-400" },
  { href: "/admin/shipping", label: "Shipping", permission: "admin.shipping.view", section: "Operations", icon: LuTruck, color: "text-blue-400" },
  { href: "/admin/coupons", label: "Coupons", permission: "admin.coupons.view", section: "Operations", icon: LuTicket, color: "text-pink-400" },
  { href: "/admin/users", label: "Users", permission: "admin.users.view", section: "Operations", icon: LuUsers, color: "text-violet-400" },
  { href: "/admin/products", label: "Products", permission: "admin.products.view", section: "Catalog", icon: LuShirt, color: "text-rose-400" },
  { href: "/admin/categories", label: "Categories", permission: "admin.categories.view", section: "Catalog", icon: LuTags, color: "text-emerald-400" },
  { href: "/admin/inventory", label: "Inventory", permission: "admin.inventory.view", section: "Catalog", icon: LuWarehouse, color: "text-orange-400" },
  { href: "/admin/reviews", label: "Reviews", permission: "admin.reviews.view", section: "Catalog", icon: LuStar, color: "text-yellow-400" },
  { href: "/admin/hero", label: "Homepage Hero", permission: "admin.hero.manage", section: "Content", icon: LuImage, color: "text-cyan-400" },
  { href: "/admin/promo-banner", label: "Promo Banner", permission: "admin.promo.manage", section: "Content", icon: LuGalleryHorizontalEnd, color: "text-fuchsia-400" },
  { href: "/admin/countdown", label: "Countdown Deal", permission: "admin.countdown.manage", section: "Content", icon: LuTimer, color: "text-red-400" },
  { href: "/admin/testimonials", label: "Testimonials", permission: "admin.testimonials.manage", section: "Content", icon: LuQuote, color: "text-lime-400" },
  { href: "/admin/newsletter", label: "Newsletter", permission: "admin.newsletter.view", section: "Content", icon: LuMail, color: "text-teal-300" },
  { href: "/admin/navigation", label: "Navigation Menu", permission: "admin.navigation.manage", section: "Content", icon: LuMenu, color: "text-indigo-400" },
  { href: "/admin/legal-pages", label: "Legal Pages", permission: "admin.legal.manage", section: "Content", icon: LuScale, color: "text-amber-300" },
  { href: "/admin/settings", label: "Settings", permission: "admin.settings.manage", section: "System", icon: LuSettings, color: "text-slate-300" },
  { href: "/admin/roles", label: "Roles", permission: "admin.roles.view", section: "System", icon: LuShield, color: "text-purple-300" },
  { href: "/admin/help", label: "Help", permission: "admin.help.view", section: "System", icon: LuInfo, color: "text-cyan-300" },
];

export const ADMIN_NAVIGATION_SECTION_ORDER: AdminNavigationSection[] = ["Overview", "Operations", "Catalog", "Content", "System"];

export const ADMIN_NAVIGATION_META_BY_HREF = new Map(
  ADMIN_NAVIGATION_META.map((item) => [item.href, item]),
);