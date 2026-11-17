import type { IconType } from "react-icons";
import {
  LuBarcode,
  LuChartColumn,
  LuClipboardList,
  LuHandshake,
  LuPercent,
  LuGift,
  LuCreditCard,
  LuGalleryHorizontalEnd,
  LuImage,
  LuInfo,
  LuLandmark,
  LuUndo2,
  LuLayoutDashboard,
  LuMail,
  LuMailOpen,
  LuMenu,
  LuPackage,
  LuQuote,
  LuScale,
  LuScanBarcode,
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

export type AdminNavigationSection = "Overview" | "Operations" | "Purchasing" | "Catalog" | "Content" | "System";

export type AdminNavigationMeta = {
  href: string;
  label: string;
  permission: string;
  section: AdminNavigationSection;
  icon: IconType;
  exact?: boolean;
};

export const ADMIN_NAVIGATION_META: AdminNavigationMeta[] = [
  { href: "/admin", label: "Dashboard", permission: "admin.dashboard.view", section: "Overview", icon: LuLayoutDashboard, exact: true },
  { href: "/pos", label: "POS", permission: "pos.access", section: "Operations", icon: LuScanBarcode },
  { href: "/admin/orders", label: "Orders", permission: "admin.orders.view", section: "Operations", icon: LuPackage },
  { href: "/admin/finance", label: "Finance", permission: "admin.finance.view", section: "Operations", icon: LuLandmark },
  { href: "/admin/tax", label: "Tax & VAT", permission: "admin.tax.view", section: "Operations", icon: LuPercent },
  { href: "/admin/reports", label: "Sales Report", permission: "admin.reports.view", section: "Operations", icon: LuChartColumn },
  { href: "/admin/returns", label: "Customer Returns", permission: "admin.orders.view", section: "Operations", icon: LuUndo2 },
  { href: "/admin/payments", label: "Payments", permission: "admin.payments.view", section: "Operations", icon: LuCreditCard },
  { href: "/admin/shipping", label: "Shipping", permission: "admin.shipping.view", section: "Operations", icon: LuTruck },
  { href: "/admin/coupons", label: "Coupons", permission: "admin.coupons.view", section: "Operations", icon: LuTicket },
  { href: "/admin/promotions", label: "Promotions", permission: "admin.promotions.view", section: "Operations", icon: LuGift },
  { href: "/admin/users", label: "Users", permission: "admin.users.view", section: "Operations", icon: LuUsers },
  { href: "/admin/roles", label: "Roles & Permissions", permission: "admin.roles.view", section: "Operations", icon: LuShield },
  { href: "/admin/contact", label: "Contact", permission: "admin.contact.view", section: "Operations", icon: LuMailOpen },
  { href: "/admin/suppliers", label: "Suppliers", permission: "admin.suppliers.view", section: "Purchasing", icon: LuHandshake },
  { href: "/admin/purchases", label: "Purchase Orders", permission: "admin.suppliers.view", section: "Purchasing", icon: LuClipboardList },
  { href: "/admin/supplier-returns", label: "Supplier Returns", permission: "admin.suppliers.view", section: "Purchasing", icon: LuUndo2 },
  { href: "/admin/products", label: "Products", permission: "admin.products.view", section: "Catalog", icon: LuShirt },
  { href: "/admin/categories", label: "Categories", permission: "admin.categories.view", section: "Catalog", icon: LuTags },
  { href: "/admin/inventory", label: "Inventory", permission: "admin.inventory.view", section: "Catalog", icon: LuWarehouse },
  { href: "/admin/products/labels", label: "Barcode Labels", permission: "admin.products.view", section: "Catalog", icon: LuBarcode },
  { href: "/admin/reviews", label: "Reviews", permission: "admin.reviews.view", section: "Catalog", icon: LuStar },
  { href: "/admin/hero", label: "Homepage Hero", permission: "admin.hero.manage", section: "Content", icon: LuImage },
  { href: "/admin/promo-banner", label: "Promo Banner", permission: "admin.promo.manage", section: "Content", icon: LuGalleryHorizontalEnd },
  { href: "/admin/countdown", label: "Countdown Deal", permission: "admin.countdown.manage", section: "Content", icon: LuTimer },
  { href: "/admin/testimonials", label: "Testimonials", permission: "admin.testimonials.manage", section: "Content", icon: LuQuote },
  { href: "/admin/newsletter", label: "Newsletter", permission: "admin.newsletter.view", section: "Content", icon: LuMail },
  { href: "/admin/navigation", label: "Navigation Menu", permission: "admin.navigation.manage", section: "Content", icon: LuMenu },
  { href: "/admin/legal-pages", label: "Legal Pages", permission: "admin.legal.manage", section: "Content", icon: LuScale },
  { href: "/admin/settings", label: "Settings", permission: "admin.settings.manage", section: "System", icon: LuSettings },
  { href: "/admin/help", label: "Help", permission: "admin.help.view", section: "System", icon: LuInfo },
];

export const ADMIN_NAVIGATION_SECTION_ORDER: AdminNavigationSection[] = ["Overview", "Operations", "Purchasing", "Catalog", "Content", "System"];

export const ADMIN_NAVIGATION_META_BY_HREF = new Map(
  ADMIN_NAVIGATION_META.map((item) => [item.href, item]),
);