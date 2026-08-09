import { Role } from "@prisma/client";
import prisma from "@/lib/db";

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
  { href: "/admin/products", label: "Products", permission: "admin.products.view" },
  { href: "/admin/categories", label: "Categories", permission: "admin.categories.view" },
  { href: "/admin/inventory", label: "Inventory", permission: "admin.inventory.view" },
  { href: "/admin/users", label: "Users", permission: "admin.users.view" },
  { href: "/admin/payments", label: "Payments", permission: "admin.payments.view" },
  { href: "/admin/coupons", label: "Coupons", permission: "admin.coupons.view" },
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
  { href: "/admin/roles", label: "Roles", permission: "admin.roles.view" },
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
  { key: "admin.products.view", label: "View Products", description: "See products inside admin screens.", area: "admin", group: "Products" },
  { key: "admin.products.manage", label: "Manage Products", description: "Create, edit, and delete products.", area: "admin", group: "Products" },
  { key: "admin.categories.view", label: "View Categories", description: "See categories and their attributes.", area: "admin", group: "Catalog" },
  { key: "admin.categories.manage", label: "Manage Categories", description: "Create, edit, and delete categories and attributes.", area: "admin", group: "Catalog" },
  { key: "admin.inventory.view", label: "View Inventory", description: "See stock, alerts, and inventory records.", area: "admin", group: "Inventory" },
  { key: "admin.inventory.manage", label: "Manage Inventory", description: "Adjust stock and create inventory transactions.", area: "admin", group: "Inventory" },
  { key: "admin.users.view", label: "View Users", description: "See user lists and user details.", area: "admin", group: "Users" },
  { key: "admin.users.manage", label: "Manage Users", description: "Create users, edit profile fields, and activate or deactivate users.", area: "admin", group: "Users" },
  { key: "admin.users.assign_roles", label: "Assign Roles", description: "Change a user's role.", area: "admin", group: "Users" },
  { key: "admin.users.delete", label: "Delete Users", description: "Delete user accounts.", area: "admin", group: "Users" },
  { key: "admin.payments.view", label: "View Payments", description: "Access payment and refund screens.", area: "admin", group: "Payments" },
  { key: "admin.payments.manage", label: "Manage Payment Gateway", description: "Change payment gateway configuration and other payment controls.", area: "admin", group: "Payments" },
  { key: "admin.coupons.view", label: "View Coupons", description: "See coupon lists and status.", area: "admin", group: "Marketing" },
  { key: "admin.coupons.manage", label: "Manage Coupons", description: "Create and update discount coupons.", area: "admin", group: "Marketing" },
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

const ALL_PERMISSION_KEYS = new Set(PERMISSION_CATALOG.map((item) => item.key));

const DEFAULT_ROLE_PERMISSIONS: Record<Role, string[]> = {
  [Role.SUPER_ADMIN]: PERMISSION_CATALOG.map((item) => item.key),
  [Role.ADMIN]: [
    "panel.admin.access",
    "admin.dashboard.view",
    "admin.orders.view",
    "admin.orders.manage",
    "admin.products.view",
    "admin.products.manage",
    "admin.categories.view",
    "admin.categories.manage",
    "admin.inventory.view",
    "admin.inventory.manage",
    "admin.users.view",
    "admin.users.manage",
    "admin.users.assign_roles",
    "admin.payments.view",
    "admin.payments.manage",
    "admin.coupons.view",
    "admin.coupons.manage",
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
    "admin.products.view",
    "admin.products.manage",
    "admin.categories.view",
    "admin.categories.manage",
    "admin.inventory.view",
    "admin.inventory.manage",
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

function sanitizePermissions(input: unknown): string[] {
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

export function normalizeRolePermissions(input: unknown): RolePermissionsMatrix {
  const defaults = buildDefaultMatrix();
  if (!input || typeof input !== "object") return defaults;

  for (const role of ROLE_ORDER) {
    const rolePermissions = (input as Record<string, unknown>)[role];
    if (rolePermissions !== undefined) {
      defaults[role] = sanitizePermissions(rolePermissions);
    }
  }

  return defaults;
}

export async function getRolePermissionsMatrix(): Promise<RolePermissionsMatrix> {
  const row = await prisma.setting.findUnique({ where: { key: ROLE_PERMISSIONS_SETTING_KEY } });
  if (!row) return buildDefaultMatrix();

  try {
    return normalizeRolePermissions(JSON.parse(row.value));
  } catch {
    return buildDefaultMatrix();
  }
}

export async function saveRolePermissionsMatrix(matrix: RolePermissionsMatrix): Promise<RolePermissionsMatrix> {
  const normalized = normalizeRolePermissions(matrix);
  await prisma.setting.upsert({
    where: { key: ROLE_PERMISSIONS_SETTING_KEY },
    update: {
      value: JSON.stringify(normalized),
      type: "json",
      group: "security",
      labelEn: "Role permissions",
      labelAr: "صلاحيات الأدوار",
    },
    create: {
      key: ROLE_PERMISSIONS_SETTING_KEY,
      value: JSON.stringify(normalized),
      type: "json",
      group: "security",
      labelEn: "Role permissions",
      labelAr: "صلاحيات الأدوار",
    },
  });

  return normalized;
}

export async function getPermissionsForRole(role: Role): Promise<string[]> {
  const matrix = await getRolePermissionsMatrix();
  return matrix[role] ?? [];
}

export async function roleHasPermission(role: Role, permission: string): Promise<boolean> {
  const permissions = await getPermissionsForRole(role);
  return permissions.includes(permission);
}
