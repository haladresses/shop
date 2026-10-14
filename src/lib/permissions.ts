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
  { href: "/admin/reports", label: "Sales Report", permission: "admin.reports.view" },
  { href: "/admin/finance", label: "Finance", permission: "admin.finance.view" },
  { href: "/admin/returns", label: "Returns", permission: "admin.orders.view" },
  { href: "/admin/products", label: "Products", permission: "admin.products.view" },
  { href: "/admin/categories", label: "Categories", permission: "admin.categories.view" },
  { href: "/admin/inventory", label: "Inventory", permission: "admin.inventory.view" },
  { href: "/pos", label: "POS", permission: "pos.access" },
  { href: "/admin/users", label: "Users", permission: "admin.users.view" },
  { href: "/admin/roles", label: "Roles & Permissions", permission: "admin.roles.view" },
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
  { key: "pos.access", label: "Use POS", description: "Sign in to the in-store POS terminal with a PIN and ring up sales.", area: "admin", group: "Point of Sale" },
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
    "admin.reports.view",
    "admin.finance.view",
    "admin.finance.manage",
    "admin.products.view",
    "admin.products.manage",
    "admin.categories.view",
    "admin.categories.manage",
    "admin.inventory.view",
    "admin.inventory.manage",
    "pos.access",
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
    "admin.reports.view",
    "admin.products.view",
    "admin.products.manage",
    "admin.categories.view",
    "admin.categories.manage",
    "admin.inventory.view",
    "admin.inventory.manage",
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

// Permissions added after a role matrix may already have been saved to the
// database. A stored matrix that predates one of these gets it granted (once)
// to the roles that have it by default; saving records them as known, so an
// admin who later unticks one keeps it unticked.
const LATER_PERMISSIONS = ["admin.finance.view", "admin.finance.manage"];
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

export async function getRolePermissionsMatrix(): Promise<RolePermissionsMatrix> {
  const row = await prisma.setting.findUnique({ where: { key: ROLE_PERMISSIONS_SETTING_KEY } });
  if (!row) return buildDefaultMatrix();

  try {
    return normalizeRolePermissions(JSON.parse(row.value), true);
  } catch {
    return buildDefaultMatrix();
  }
}

export async function saveRolePermissionsMatrix(matrix: RolePermissionsMatrix): Promise<RolePermissionsMatrix> {
  const normalized = normalizeRolePermissions(matrix);
  const stored = JSON.stringify({ ...normalized, [KNOWN_PERMISSIONS_FIELD]: [...ALL_PERMISSION_KEYS] });
  await prisma.setting.upsert({
    where: { key: ROLE_PERMISSIONS_SETTING_KEY },
    update: {
      value: stored,
      type: "json",
      group: "security",
      labelEn: "Role permissions",
      labelAr: "صلاحيات الأدوار",
    },
    create: {
      key: ROLE_PERMISSIONS_SETTING_KEY,
      value: stored,
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


// ─────────────────────────────────────────────
// Per-user overrides & role ranking
// ─────────────────────────────────────────────

export type PermissionOverrides = { grant: string[]; revoke: string[] };

export function parseOverrides(raw: unknown): PermissionOverrides {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return { grant: sanitizePermissions(o.grant), revoke: sanitizePermissions(o.revoke) };
}

/** Role permissions, plus this user's extra grants, minus their revokes. */
export async function getEffectivePermissions(user: { role: Role; permissionOverrides?: unknown }): Promise<string[]> {
  const base = await getPermissionsForRole(user.role);
  if (user.role === Role.SUPER_ADMIN) return base; // always everything
  const { grant, revoke } = parseOverrides(user.permissionOverrides);
  const set = new Set([...base, ...grant]);
  for (const r of revoke) set.delete(r);
  return Array.from(set).sort();
}

/** Higher number = more senior. Used to stop privilege escalation. */
export const ROLE_RANK: Record<Role, number> = {
  [Role.SUPER_ADMIN]: 4,
  [Role.ADMIN]: 3,
  [Role.STAFF]: 2,
  [Role.SELLER]: 1,
  [Role.CUSTOMER]: 0,
};

/** Actor may edit/deactivate/delete the target account. */
export function canManageUser(actor: { id: string; role: Role }, target: { id: string; role: Role }): boolean {
  if (actor.id === target.id) return false;
  if (actor.role === Role.SUPER_ADMIN) return true;
  return ROLE_RANK[actor.role] > ROLE_RANK[target.role];
}

/** Actor may give someone this role (never above — or, except super admins, equal to — their own). */
export function canAssignRole(actor: { role: Role }, role: Role): boolean {
  if (actor.role === Role.SUPER_ADMIN) return true;
  return ROLE_RANK[role] < ROLE_RANK[actor.role];
}
