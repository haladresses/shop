import { Role } from "@prisma/client";
import prisma from "@/lib/db";

/**
 * Legacy storage of the role -> permissions matrix (settings table). Roles now
 * live in the `app_roles` table; this row is only read once, to seed the
 * built-in roles on databases that predate it.
 */
export const ROLE_PERMISSIONS_SETTING_KEY = "rbac_role_permissions_v1";

export type PermissionDefinition = {
  key: string;
  label: string;
  description: string;
  area: "admin" | "seller" | "system";
  group: string;
};

export type NavPermissionItem = {
  href: string;
  label: string;
  permission: string;
  exact?: boolean;
};

export const ROLE_ORDER: Role[] = [
  Role.SUPER_ADMIN,
  Role.ADMIN,
  Role.STAFF,
  Role.SELLER,
  Role.CUSTOMER,
];

export const ROLE_LABELS: Record<Role, { en: string; ar: string }> = {
  [Role.SUPER_ADMIN]: { en: "Super Admin", ar: "مدير عام" },
  [Role.ADMIN]: { en: "Admin", ar: "مدير" },
  [Role.STAFF]: { en: "Staff", ar: "موظف" },
  [Role.SELLER]: { en: "Seller", ar: "بائع" },
  [Role.CUSTOMER]: { en: "Customer", ar: "عميل" },
};

export const ADMIN_NAV_ITEMS: NavPermissionItem[] = [
  { href: "/admin", label: "Dashboard", permission: "admin.dashboard.view", exact: true },
  { href: "/admin/orders", label: "Orders", permission: "admin.orders.view" },
  { href: "/admin/reports", label: "Sales Report", permission: "admin.reports.view" },
  { href: "/admin/delivery-report", label: "Shipping Report", permission: "admin.reports.view" },
  { href: "/admin/finance", label: "Finance", permission: "admin.finance.view" },
  { href: "/admin/returns", label: "Returns", permission: "admin.orders.view" },
  { href: "/admin/products", label: "Products", permission: "admin.products.view" },
  { href: "/admin/categories", label: "Categories", permission: "admin.categories.view" },
  { href: "/admin/inventory", label: "Inventory", permission: "admin.inventory.view" },
  { href: "/admin/suppliers", label: "Suppliers", permission: "admin.suppliers.view" },
  { href: "/admin/purchases", label: "Purchase Orders", permission: "admin.suppliers.view" },
  { href: "/admin/supplier-returns", label: "Supplier Returns", permission: "admin.suppliers.view" },
  { href: "/admin/tax", label: "Tax & VAT", permission: "admin.tax.view" },
  { href: "/pos", label: "POS", permission: "pos.access" },
  { href: "/admin/users", label: "Users", permission: "admin.users.view" },
  { href: "/admin/roles", label: "Roles & Permissions", permission: "admin.roles.view" },
  { href: "/admin/payments", label: "Payments", permission: "admin.payments.view" },
  { href: "/admin/coupons", label: "Coupons", permission: "admin.coupons.view" },
  { href: "/admin/promotions", label: "Promotions", permission: "admin.promotions.view" },
  { href: "/admin/shipping", label: "Shipping", permission: "admin.shipping.view" },
  { href: "/admin/reviews", label: "Reviews", permission: "admin.reviews.view" },
  { href: "/admin/hero", label: "Homepage Hero", permission: "admin.hero.manage" },
  { href: "/admin/promo-banner", label: "Promo Banner", permission: "admin.promo.manage" },
  { href: "/admin/countdown", label: "Countdown Deal", permission: "admin.countdown.manage" },
  { href: "/admin/testimonials", label: "Testimonials", permission: "admin.testimonials.manage" },
  { href: "/admin/newsletter", label: "Newsletter", permission: "admin.newsletter.view" },
  { href: "/admin/contact", label: "Contact", permission: "admin.contact.view" },
  { href: "/admin/legal-pages", label: "Legal Pages", permission: "admin.legal.manage" },
  { href: "/admin/navigation", label: "Navigation Menu", permission: "admin.navigation.manage" },
  { href: "/admin/settings", label: "Settings", permission: "admin.settings.manage" },
  { href: "/admin/help", label: "Help", permission: "admin.help.view" },
];

export const SELLER_NAV_ITEMS: NavPermissionItem[] = [
  { href: "/seller", label: "Dashboard", permission: "seller.dashboard.view", exact: true },
  { href: "/seller/products", label: "My Products", permission: "seller.products.view" },
  { href: "/seller/orders", label: "Orders", permission: "seller.orders.view" },
  { href: "/seller/inventory", label: "Inventory", permission: "seller.inventory.view" },
  { href: "/seller/analytics", label: "Analytics", permission: "seller.analytics.view" },
];

export const PERMISSION_CATALOG: PermissionDefinition[] = [
  { key: "panel.admin.access", label: "Admin Panel Access", description: "Can sign in to and open the admin panel.", area: "system", group: "Admin Panel" },
  { key: "admin.dashboard.view", label: "View Dashboard", description: "See admin KPIs and summary cards.", area: "admin", group: "Dashboard" },
  { key: "admin.orders.view", label: "View Orders", description: "See order lists and details.", area: "admin", group: "Orders" },
  { key: "admin.orders.manage", label: "Manage Orders", description: "Update order statuses and operational actions.", area: "admin", group: "Orders" },
  { key: "admin.reports.view", label: "View Sales Report", description: "See revenue and order counts broken down by online vs POS.", area: "admin", group: "Orders" },
  { key: "admin.finance.view", label: "View Finance", description: "See revenue, profit, expenses and daily/weekly/monthly/yearly finance reports.", area: "admin", group: "Finance" },
  { key: "admin.finance.manage", label: "Manage Expenses", description: "Record, edit and delete operating expenses.", area: "admin", group: "Finance" },
  { key: "admin.products.view", label: "View Products", description: "See products inside admin screens.", area: "admin", group: "Products" },
  { key: "admin.products.manage", label: "Manage Products", description: "Create, edit, and delete products.", area: "admin", group: "Products" },
  { key: "admin.categories.view", label: "View Categories", description: "See categories and their attributes.", area: "admin", group: "Catalog" },
  { key: "admin.categories.manage", label: "Manage Categories", description: "Create, edit, and delete categories and attributes.", area: "admin", group: "Catalog" },
  { key: "admin.inventory.view", label: "View Inventory", description: "See stock, alerts, and inventory records.", area: "admin", group: "Inventory" },
  { key: "admin.inventory.manage", label: "Manage Inventory", description: "Adjust stock and create inventory transactions.", area: "admin", group: "Inventory" },
  { key: "admin.suppliers.view", label: "View Suppliers & Purchases", description: "See suppliers, purchase orders, balances owed, statements and supplier tasks.", area: "admin", group: "Purchasing" },
  { key: "admin.suppliers.manage", label: "Manage Suppliers", description: "Create and edit suppliers and their follow-up tasks.", area: "admin", group: "Purchasing" },
  { key: "admin.purchases.manage", label: "Manage Purchase Orders", description: "Create, edit, place and cancel purchase orders.", area: "admin", group: "Purchasing" },
  { key: "admin.purchases.receive", label: "Receive & Return Goods", description: "Receive deliveries into stock and send goods back to suppliers.", area: "admin", group: "Purchasing" },
  { key: "admin.supplier_payments.manage", label: "Supplier Payments", description: "Record and void payments to suppliers.", area: "admin", group: "Purchasing" },
  { key: "admin.tax.view", label: "View VAT Report", description: "See the VAT return (output and input VAT) and tax settings.", area: "admin", group: "Tax & VAT" },
  { key: "admin.tax.manage", label: "Manage Tax & VAT", description: "Turn VAT on/off, edit the VAT number, rates and which products they apply to.", area: "admin", group: "Tax & VAT" },
  { key: "pos.access", label: "Use POS", description: "Sign in to the in-store POS terminal with a PIN and ring up sales.", area: "admin", group: "Point of Sale" },
  { key: "admin.users.view", label: "View Users", description: "See user lists and user details.", area: "admin", group: "Users" },
  { key: "admin.users.manage", label: "Manage Users", description: "Create users, edit profile fields, and activate or deactivate users.", area: "admin", group: "Users" },
  { key: "admin.users.assign_roles", label: "Assign Roles", description: "Change a user's role.", area: "admin", group: "Users" },
  { key: "admin.users.delete", label: "Delete Users", description: "Delete user accounts.", area: "admin", group: "Users" },
  { key: "admin.payments.view", label: "View Payments", description: "Access payment and refund screens.", area: "admin", group: "Payments" },
  { key: "admin.payments.manage", label: "Manage Payment Gateway", description: "Change payment gateway configuration and other payment controls.", area: "admin", group: "Payments" },
  { key: "admin.coupons.view", label: "View Coupons", description: "See coupon lists and status.", area: "admin", group: "Marketing" },
  { key: "admin.coupons.manage", label: "Manage Coupons", description: "Create and update discount coupons.", area: "admin", group: "Marketing" },
  { key: "admin.promotions.view", label: "View Promotions", description: "See promotions (buy X get Y, mix & match, % off …) and how they perform.", area: "admin", group: "Marketing" },
  { key: "admin.promotions.manage", label: "Manage Promotions", description: "Create, schedule, pause and delete automatic promotions.", area: "admin", group: "Marketing" },
  { key: "admin.shipping.view", label: "View Shipping", description: "Access shipping settings and Wasellee data.", area: "admin", group: "Shipping" },
  { key: "admin.shipping.manage", label: "Manage Shipping", description: "Update shipping settings, branches, and rates.", area: "admin", group: "Shipping" },
  { key: "admin.reviews.view", label: "View Reviews", description: "See review moderation screens.", area: "admin", group: "Content" },
  { key: "admin.reviews.manage", label: "Manage Reviews", description: "Approve, reject, or otherwise moderate reviews.", area: "admin", group: "Content" },
  { key: "admin.hero.manage", label: "Manage Homepage Hero", description: "Edit homepage hero content.", area: "admin", group: "Content" },
  { key: "admin.promo.manage", label: "Manage Promo Banner", description: "Edit promo banner content.", area: "admin", group: "Content" },
  { key: "admin.countdown.manage", label: "Manage Countdown Deal", description: "Edit countdown deal content.", area: "admin", group: "Content" },
  { key: "admin.testimonials.manage", label: "Manage Testimonials", description: "Edit testimonials content.", area: "admin", group: "Content" },
  { key: "admin.newsletter.view", label: "View Newsletter", description: "See newsletter settings and subscribers.", area: "admin", group: "Content" },
  { key: "admin.newsletter.manage", label: "Manage Newsletter", description: "Update newsletter settings and subscribers.", area: "admin", group: "Content" },
  { key: "admin.contact.view", label: "View Contact", description: "Open the Contact Us screen, read submitted messages, and see contact details.", area: "admin", group: "Contact" },
  { key: "admin.contact.manage", label: "Manage Contact", description: "Edit store contact details and update or delete contact messages.", area: "admin", group: "Contact" },
  { key: "admin.legal.manage", label: "Manage Legal Pages", description: "Edit legal pages and policies.", area: "admin", group: "Content" },
  { key: "admin.navigation.manage", label: "Manage Navigation", description: "Edit header and footer navigation.", area: "admin", group: "Content" },
  { key: "admin.settings.manage", label: "Manage Settings", description: "Update store-wide settings.", area: "admin", group: "Settings" },
  { key: "admin.help.view", label: "View Help Center", description: "Open the permission-aware admin help center.", area: "admin", group: "Help & Onboarding" },
  { key: "admin.backups.view", label: "View Backups", description: "See backup history and download archives.", area: "admin", group: "Backups" },
  { key: "admin.backups.create", label: "Create Backups", description: "Create manual backups.", area: "admin", group: "Backups" },
  { key: "admin.backups.schedule", label: "Manage Backup Schedule", description: "Change automatic backup schedule settings.", area: "admin", group: "Backups" },
  { key: "admin.backups.restore", label: "Restore Backups", description: "Restore uploaded or saved backup archives.", area: "admin", group: "Backups" },
  { key: "admin.backups.delete", label: "Delete Backups", description: "Delete backup archives and records.", area: "admin", group: "Backups" },
  { key: "admin.roles.view", label: "View Roles", description: "Open the roles and permissions screen.", area: "admin", group: "Roles & Permissions" },
  { key: "admin.roles.manage", label: "Manage Roles", description: "Change permission assignments for each role.", area: "admin", group: "Roles & Permissions" },
  { key: "panel.seller.access", label: "Seller Portal Access", description: "Can sign in to and open the seller portal.", area: "system", group: "Seller Portal" },
  { key: "seller.dashboard.view", label: "View Seller Dashboard", description: "See seller dashboard summary.", area: "seller", group: "Seller Dashboard" },
  { key: "seller.products.view", label: "View Seller Products", description: "See seller product lists.", area: "seller", group: "Seller Products" },
  { key: "seller.products.manage", label: "Manage Seller Products", description: "Create and update seller-owned products.", area: "seller", group: "Seller Products" },
  { key: "seller.orders.view", label: "View Seller Orders", description: "See seller-relevant orders.", area: "seller", group: "Seller Orders" },
  { key: "seller.orders.manage", label: "Manage Seller Orders", description: "Perform seller order actions.", area: "seller", group: "Seller Orders" },
  { key: "seller.inventory.view", label: "View Seller Inventory", description: "See seller inventory records.", area: "seller", group: "Seller Inventory" },
  { key: "seller.inventory.manage", label: "Manage Seller Inventory", description: "Adjust seller inventory quantities.", area: "seller", group: "Seller Inventory" },
  { key: "seller.analytics.view", label: "View Seller Analytics", description: "Access seller analytics pages.", area: "seller", group: "Seller Analytics" },
  { key: "seller.uploads.manage", label: "Manage Uploads", description: "Upload product and content images.", area: "seller", group: "Seller Operations" },
];

export const ALL_PERMISSIONS: string[] = PERMISSION_CATALOG.map((item) => item.key).sort();
const ALL_PERMISSION_KEYS = new Set(ALL_PERMISSIONS);

/** "view" = can see; "manage" = can change or act; "access" = can open a panel/terminal. */
export type PermissionKind = "access" | "view" | "manage";
export function permissionKind(key: string): PermissionKind {
  if (key.endsWith(".view")) return "view";
  if (key.endsWith(".access")) return "access";
  return "manage";
}

// Acting on something you can't open is useless: these need another permission to work.
const EXTRA_REQUIRES: Record<string, string[]> = {
  "admin.purchases.manage": ["admin.suppliers.view"],
  "admin.purchases.receive": ["admin.suppliers.view"],
  "admin.supplier_payments.manage": ["admin.suppliers.view"],
};

/** Permissions this one depends on (e.g. "admin.orders.manage" needs "admin.orders.view"). */
export function permissionRequires(key: string): string[] {
  const out = new Set<string>(EXTRA_REQUIRES[key] ?? []);
  const parts = key.split(".");
  if (parts.length === 3 && parts[2] !== "view") {
    const view = `${parts[0]}.${parts[1]}.view`;
    if (ALL_PERMISSION_KEYS.has(view)) out.add(view);
  }
  out.delete(key);
  return Array.from(out);
}

export const DEFAULT_ROLE_PERMISSIONS: Record<Role, string[]> = {
  [Role.SUPER_ADMIN]: PERMISSION_CATALOG.map((item) => item.key),
  [Role.ADMIN]: [
    "panel.admin.access",
    "admin.dashboard.view",
    "admin.orders.view",
    "admin.orders.manage",
    "admin.reports.view",
    "admin.finance.view",
    "admin.finance.manage",
    "admin.products.view",
    "admin.products.manage",
    "admin.categories.view",
    "admin.categories.manage",
    "admin.inventory.view",
    "admin.inventory.manage",
    "admin.suppliers.view",
    "admin.suppliers.manage",
    "admin.purchases.manage",
    "admin.purchases.receive",
    "admin.supplier_payments.manage",
    "admin.tax.view",
    "admin.tax.manage",
    "pos.access",
    "admin.users.view",
    "admin.users.manage",
    "admin.users.assign_roles",
    "admin.payments.view",
    "admin.payments.manage",
    "admin.coupons.view",
    "admin.coupons.manage",
    "admin.promotions.view",
    "admin.promotions.manage",
    "admin.shipping.view",
    "admin.shipping.manage",
    "admin.reviews.view",
    "admin.reviews.manage",
    "admin.hero.manage",
    "admin.promo.manage",
    "admin.countdown.manage",
    "admin.testimonials.manage",
    "admin.newsletter.view",
    "admin.newsletter.manage",
    "admin.contact.view",
    "admin.contact.manage",
    "admin.legal.manage",
    "admin.navigation.manage",
    "admin.settings.manage",
    "admin.help.view",
    "admin.backups.view",
    "admin.backups.create",
    "admin.backups.schedule",
    "panel.seller.access",
    "seller.dashboard.view",
    "seller.products.view",
    "seller.products.manage",
    "seller.orders.view",
    "seller.orders.manage",
    "seller.inventory.view",
    "seller.inventory.manage",
    "seller.analytics.view",
    "seller.uploads.manage",
  ],
  [Role.STAFF]: [
    "panel.admin.access",
    "admin.dashboard.view",
    "admin.orders.view",
    "admin.orders.manage",
    "admin.reports.view",
    "admin.products.view",
    "admin.products.manage",
    "admin.categories.view",
    "admin.categories.manage",
    "admin.inventory.view",
    "admin.inventory.manage",
    "admin.suppliers.view",
    "admin.purchases.receive",
    "pos.access",
    "admin.reviews.view",
    "admin.reviews.manage",
    "admin.newsletter.view",
    "admin.contact.view",
    "admin.contact.manage",
    "admin.help.view",
    "admin.backups.view",
  ],
  [Role.SELLER]: [
    "panel.seller.access",
    "seller.dashboard.view",
    "seller.products.view",
    "seller.products.manage",
    "seller.orders.view",
    "seller.orders.manage",
    "seller.inventory.view",
    "seller.inventory.manage",
    "seller.analytics.view",
    "seller.uploads.manage",
  ],
  [Role.CUSTOMER]: [],
};

export type RolePermissionsMatrix = Record<Role, string[]>;

/** Keep only known permission keys, de-duplicated and sorted. */
export function sanitizePermissions(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return Array.from(
    new Set(
      input.filter((value): value is string => typeof value === "string" && ALL_PERMISSION_KEYS.has(value))
    )
  ).sort();
}

function buildDefaultMatrix(): RolePermissionsMatrix {
  return ROLE_ORDER.reduce((acc, role) => {
    acc[role] = [...DEFAULT_ROLE_PERMISSIONS[role]].sort();
    return acc;
  }, {} as RolePermissionsMatrix);
}

// ─────────────────────────────────────────────
// Built-in roles
// ─────────────────────────────────────────────

/** Fixed palette for role colours (solid, readable on white). */
export const ROLE_COLORS = [
  "#c026d3", // fuchsia
  "#7c3aed", // violet
  "#4f46e5", // indigo
  "#2563eb", // blue
  "#0284c7", // sky
  "#0d9488", // teal
  "#059669", // emerald
  "#65a30d", // lime
  "#d97706", // amber
  "#ea580c", // orange
  "#e11d48", // rose
  "#db2777", // pink
  "#78716c", // stone
  "#64748b", // slate
] as const;

/** Seniority by account type: used for built-in roles and as a fallback. */
export const ROLE_RANK: Record<Role, number> = {
  [Role.SUPER_ADMIN]: 100,
  [Role.ADMIN]: 80,
  [Role.STAFF]: 60,
  [Role.SELLER]: 40,
  [Role.CUSTOMER]: 0,
};
/** Highest rank a custom role may have (super admin stays on top). */
export const MAX_CUSTOM_RANK = 99;

export const BUILTIN_ROLE_KEY: Record<Role, string> = {
  [Role.SUPER_ADMIN]: "super_admin",
  [Role.ADMIN]: "admin",
  [Role.STAFF]: "staff",
  [Role.SELLER]: "seller",
  [Role.CUSTOMER]: "customer",
};
export const SUPER_ADMIN_ROLE_KEY = BUILTIN_ROLE_KEY[Role.SUPER_ADMIN];

export const BUILTIN_ROLES: {
  key: string;
  type: Role;
  nameEn: string;
  nameAr: string;
  description: string;
  color: string;
  rank: number;
  sortOrder: number;
}[] = [
  { key: "super_admin", type: Role.SUPER_ADMIN, nameEn: "Super Admin", nameAr: "مدير عام", description: "Owner level. Always has every permission and can manage everyone.", color: "#c026d3", rank: ROLE_RANK.SUPER_ADMIN, sortOrder: 0 },
  { key: "admin", type: Role.ADMIN, nameEn: "Admin", nameAr: "مدير", description: "Runs the store day to day: orders, products, stock, people and settings.", color: "#7c3aed", rank: ROLE_RANK.ADMIN, sortOrder: 1 },
  { key: "staff", type: Role.STAFF, nameEn: "Staff", nameAr: "موظف", description: "Shop floor and back office: orders, products, stock and the POS.", color: "#059669", rank: ROLE_RANK.STAFF, sortOrder: 2 },
  { key: "seller", type: Role.SELLER, nameEn: "Seller", nameAr: "بائع", description: "Marketplace seller with access to the seller portal only.", color: "#0284c7", rank: ROLE_RANK.SELLER, sortOrder: 3 },
  { key: "customer", type: Role.CUSTOMER, nameEn: "Customer", nameAr: "عميل", description: "Shops on the website. No access to the admin panel.", color: "#64748b", rank: ROLE_RANK.CUSTOMER, sortOrder: 4 },
];

// ─────────────────────────────────────────────
// Legacy settings matrix (read-only, used once to seed built-in roles)
// ─────────────────────────────────────────────

// Permissions added after a role matrix may already have been saved to the
// database. A stored matrix that predates one of these gets it granted (once)
// to the roles that have it by default.
const LATER_PERMISSIONS = [
  "admin.finance.view",
  "admin.finance.manage",
  "admin.suppliers.view",
  "admin.suppliers.manage",
  "admin.purchases.manage",
  "admin.purchases.receive",
  "admin.supplier_payments.manage",
  "admin.tax.view",
  "admin.tax.manage",
  "admin.promotions.view",
  "admin.promotions.manage",
];
const KNOWN_PERMISSIONS_FIELD = "__known";

export function normalizeRolePermissions(input: unknown, applyLaterDefaults = false): RolePermissionsMatrix {
  const defaults = buildDefaultMatrix();
  if (!input || typeof input !== "object") return defaults;

  const rawKnown = (input as Record<string, unknown>)[KNOWN_PERMISSIONS_FIELD];
  const known = new Set(Array.isArray(rawKnown) ? rawKnown : []);

  for (const role of ROLE_ORDER) {
    const rolePermissions = (input as Record<string, unknown>)[role];
    if (rolePermissions !== undefined) {
      const sanitized = sanitizePermissions(rolePermissions);
      if (applyLaterDefaults) {
        for (const key of LATER_PERMISSIONS) {
          if (!known.has(key) && DEFAULT_ROLE_PERMISSIONS[role].includes(key) && !sanitized.includes(key)) {
            sanitized.push(key);
          }
        }
        sanitized.sort();
      }
      defaults[role] = sanitized;
    }
  }

  return defaults;
}

/** The matrix as the pre-AppRole code computed it (settings row, or defaults). */
async function readLegacyMatrix(): Promise<RolePermissionsMatrix> {
  const row = await prisma.setting.findUnique({ where: { key: ROLE_PERMISSIONS_SETTING_KEY } });
  if (!row) return buildDefaultMatrix();
  try {
    return normalizeRolePermissions(JSON.parse(row.value), true);
  } catch {
    return buildDefaultMatrix();
  }
}

// ─────────────────────────────────────────────
// Role cache (permissions are checked on every request)
// ─────────────────────────────────────────────

export type CachedRole = {
  id: string;
  key: string;
  nameEn: string;
  nameAr: string | null;
  color: string;
  type: Role;
  rank: number;
  isSystem: boolean;
  /** Sanitized. For the super admin role: always the full catalog. */
  permissions: string[];
};

type RoleCache = { at: number; byId: Map<string, CachedRole>; byKey: Map<string, CachedRole> };

const CACHE_TTL_MS = 30_000;
const roleState = globalThis as unknown as {
  __appRoleCache?: RoleCache | null;
  __appRoleSync?: Promise<void> | null;
  __appRoleSynced?: boolean;
};

/** Call after any write to app_roles so the next permission check reloads. */
export function invalidateRoleCache() {
  roleState.__appRoleCache = null;
}

/**
 * One-time (per process) upkeep, idempotent and safe to run concurrently:
 *  1. create any missing built-in role, seeded from the legacy settings matrix;
 *  2. point users without a role at the built-in role for their account type;
 *  3. grant permissions that were added to the catalog since the last run to the
 *     built-in roles that have them by default (the super admin row's stored
 *     list records which keys were already known).
 */
async function syncRoles() {
  const existing = await prisma.appRole.findMany({ where: { key: { in: BUILTIN_ROLES.map((r) => r.key) } } });
  const have = new Set(existing.map((r) => r.key));
  const missing = BUILTIN_ROLES.filter((r) => !have.has(r.key));

  if (missing.length) {
    const legacy = await readLegacyMatrix();
    await prisma.appRole.createMany({
      data: missing.map((r) => ({
        id: `role_${r.key}`,
        key: r.key,
        nameEn: r.nameEn,
        nameAr: r.nameAr,
        description: r.description,
        color: r.color,
        type: r.type,
        rank: r.rank,
        sortOrder: r.sortOrder,
        isSystem: true,
        permissions: r.type === Role.SUPER_ADMIN ? ALL_PERMISSIONS : legacy[r.type],
      })),
      skipDuplicates: true,
    });
  }

  const builtins = await prisma.appRole.findMany({ where: { key: { in: BUILTIN_ROLES.map((r) => r.key) } } });
  for (const r of builtins) {
    if (!BUILTIN_ROLES.some((b) => b.key === r.key && b.type === r.type)) continue;
    await prisma.user.updateMany({ where: { roleId: null, role: r.type }, data: { roleId: r.id } });
  }

  const superRole = builtins.find((r) => r.key === SUPER_ADMIN_ROLE_KEY);
  if (superRole) {
    const known = new Set(superRole.permissions);
    const added = ALL_PERMISSIONS.filter((k) => !known.has(k));
    if (added.length) {
      for (const r of builtins) {
        if (r.key === SUPER_ADMIN_ROLE_KEY) continue;
        const def = BUILTIN_ROLES.find((b) => b.key === r.key);
        if (!def) continue;
        const grant = added.filter((k) => DEFAULT_ROLE_PERMISSIONS[def.type].includes(k));
        if (grant.length) {
          await prisma.appRole.update({ where: { id: r.id }, data: { permissions: sanitizePermissions([...r.permissions, ...grant]) } });
        }
      }
      await prisma.appRole.update({ where: { id: superRole.id }, data: { permissions: ALL_PERMISSIONS } });
    }
  }
}

async function ensureSynced() {
  if (roleState.__appRoleSynced) return;
  if (!roleState.__appRoleSync) {
    roleState.__appRoleSync = syncRoles()
      .then(() => {
        roleState.__appRoleSynced = true;
      })
      .finally(() => {
        roleState.__appRoleSync = null;
      });
  }
  await roleState.__appRoleSync;
}

async function loadRoleCache(): Promise<RoleCache> {
  const cached = roleState.__appRoleCache;
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached;
  await ensureSynced();
  const rows = await prisma.appRole.findMany({
    select: { id: true, key: true, nameEn: true, nameAr: true, color: true, type: true, rank: true, isSystem: true, permissions: true },
  });
  const byId = new Map<string, CachedRole>();
  const byKey = new Map<string, CachedRole>();
  for (const r of rows) {
    const role: CachedRole = {
      ...r,
      permissions: r.type === Role.SUPER_ADMIN ? ALL_PERMISSIONS : sanitizePermissions(r.permissions),
    };
    byId.set(r.id, role);
    byKey.set(r.key, role);
  }
  const next = { at: Date.now(), byId, byKey };
  roleState.__appRoleCache = next;
  return next;
}

export async function getCachedRole(id: string): Promise<CachedRole | null> {
  return (await loadRoleCache()).byId.get(id) ?? null;
}

/** The built-in role for an account type (null only if the table is unreachable). */
export async function getBuiltInRole(type: Role): Promise<CachedRole | null> {
  return (await loadRoleCache()).byKey.get(BUILTIN_ROLE_KEY[type]) ?? null;
}

// ─────────────────────────────────────────────
// Effective permissions
// ─────────────────────────────────────────────

export type PermissionOverrides = { grant: string[]; revoke: string[] };

export function parseOverrides(raw: unknown): PermissionOverrides {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return { grant: sanitizePermissions(o.grant), revoke: sanitizePermissions(o.revoke) };
}

/** Anything permissions are computed for: a user row or the session user. */
export type PermissionSubject = { role: Role; roleId: string | null; permissionOverrides?: unknown };

/** The user's assigned role, or the built-in role for their account type. */
export async function resolveUserRole(user: { role: Role; roleId: string | null }): Promise<CachedRole | null> {
  const cache = await loadRoleCache();
  return (user.roleId ? cache.byId.get(user.roleId) : undefined) ?? cache.byKey.get(BUILTIN_ROLE_KEY[user.role]) ?? null;
}

/** Permissions the role gives, before this user's overrides. */
export async function getRoleBasePermissions(user: { role: Role; roleId: string | null }): Promise<string[]> {
  if (user.role === Role.SUPER_ADMIN) return ALL_PERMISSIONS;
  const role = await resolveUserRole(user);
  return role ? role.permissions : [...DEFAULT_ROLE_PERMISSIONS[user.role]].sort();
}

/** Role permissions, plus this user's extra grants, minus their revokes. Super admins: everything. */
export async function getEffectivePermissions(user: PermissionSubject): Promise<string[]> {
  if (user.role === Role.SUPER_ADMIN) return ALL_PERMISSIONS; // always everything
  const base = await getRoleBasePermissions(user);
  const { grant, revoke } = parseOverrides(user.permissionOverrides);
  const set = new Set([...base, ...grant]);
  for (const r of revoke) set.delete(r);
  return Array.from(set).sort();
}

/** Seniority of the user's role (higher = more senior). */
export async function getUserRank(user: { role: Role; roleId: string | null }): Promise<number> {
  if (user.role === Role.SUPER_ADMIN) return ROLE_RANK.SUPER_ADMIN;
  const role = await resolveUserRole(user);
  return role?.rank ?? ROLE_RANK[user.role];
}

/** Permissions of the built-in role for an account type. */
export async function getPermissionsForRole(role: Role): Promise<string[]> {
  if (role === Role.SUPER_ADMIN) return ALL_PERMISSIONS;
  const builtIn = await getBuiltInRole(role);
  return builtIn ? builtIn.permissions : [...DEFAULT_ROLE_PERMISSIONS[role]].sort();
}

export async function roleHasPermission(role: Role, permission: string): Promise<boolean> {
  const permissions = await getPermissionsForRole(role);
  return permissions.includes(permission);
}

/** Built-in roles' permissions keyed by account type. */
export async function getRolePermissionsMatrix(): Promise<RolePermissionsMatrix> {
  const entries = await Promise.all(ROLE_ORDER.map(async (role) => [role, await getPermissionsForRole(role)] as const));
  return Object.fromEntries(entries) as RolePermissionsMatrix;
}
