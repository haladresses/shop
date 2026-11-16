-- Custom roles (app_roles) + users.roleId. Schema part generated with
-- prisma migrate diff; the data step below seeds the built-in roles.

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "roleId" TEXT;

-- CreateTable
CREATE TABLE "app_roles" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameAr" TEXT,
    "description" TEXT,
    "color" TEXT NOT NULL DEFAULT '#64748b',
    "type" "Role" NOT NULL DEFAULT 'STAFF',
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "rank" INTEGER NOT NULL DEFAULT 10,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "app_roles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "app_roles_key_key" ON "app_roles"("key");

-- CreateIndex
CREATE INDEX "app_roles_type_idx" ON "app_roles"("type");

-- CreateIndex
CREATE INDEX "users_roleId_idx" ON "users"("roleId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "app_roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_roles" ADD CONSTRAINT "app_roles_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ─────────────────────────────────────────────────────────────
-- Data: the five built-in roles, seeded from the legacy role matrix
-- (settings key rbac_role_permissions_v1) exactly as the old code read it:
-- unknown keys dropped, permissions added later back-filled once to roles that
-- had them by default (unless the stored matrix already knew them), defaults
-- for any role missing from the matrix. Then every user without a role gets the
-- built-in role matching their account type. Idempotent: safe to run again.
-- The app performs the same step on start-up (src/lib/permissions.ts, syncRoles).
-- ─────────────────────────────────────────────────────────────
DO $roles$
DECLARE
  catalog text[] := ARRAY['admin.backups.create', 'admin.backups.delete', 'admin.backups.restore', 'admin.backups.schedule', 'admin.backups.view', 'admin.categories.manage', 'admin.categories.view', 'admin.contact.manage', 'admin.contact.view', 'admin.countdown.manage', 'admin.coupons.manage', 'admin.coupons.view', 'admin.dashboard.view', 'admin.finance.manage', 'admin.finance.view', 'admin.help.view', 'admin.hero.manage', 'admin.inventory.manage', 'admin.inventory.view', 'admin.legal.manage', 'admin.navigation.manage', 'admin.newsletter.manage', 'admin.newsletter.view', 'admin.orders.manage', 'admin.orders.view', 'admin.payments.manage', 'admin.payments.view', 'admin.products.manage', 'admin.products.view', 'admin.promo.manage', 'admin.promotions.manage', 'admin.promotions.view', 'admin.purchases.manage', 'admin.purchases.receive', 'admin.reports.view', 'admin.reviews.manage', 'admin.reviews.view', 'admin.roles.manage', 'admin.roles.view', 'admin.settings.manage', 'admin.shipping.manage', 'admin.shipping.view', 'admin.supplier_payments.manage', 'admin.suppliers.manage', 'admin.suppliers.view', 'admin.tax.manage', 'admin.tax.view', 'admin.testimonials.manage', 'admin.users.assign_roles', 'admin.users.delete', 'admin.users.manage', 'admin.users.view', 'panel.admin.access', 'panel.seller.access', 'pos.access', 'seller.analytics.view', 'seller.dashboard.view', 'seller.inventory.manage', 'seller.inventory.view', 'seller.orders.manage', 'seller.orders.view', 'seller.products.manage', 'seller.products.view', 'seller.uploads.manage']::text[];
  later text[] := ARRAY['admin.finance.view', 'admin.finance.manage', 'admin.suppliers.view', 'admin.suppliers.manage', 'admin.purchases.manage', 'admin.purchases.receive', 'admin.supplier_payments.manage', 'admin.tax.view', 'admin.tax.manage', 'admin.promotions.view', 'admin.promotions.manage']::text[];
  defaults jsonb := '{"ADMIN":["admin.backups.create","admin.backups.schedule","admin.backups.view","admin.categories.manage","admin.categories.view","admin.contact.manage","admin.contact.view","admin.countdown.manage","admin.coupons.manage","admin.coupons.view","admin.dashboard.view","admin.finance.manage","admin.finance.view","admin.help.view","admin.hero.manage","admin.inventory.manage","admin.inventory.view","admin.legal.manage","admin.navigation.manage","admin.newsletter.manage","admin.newsletter.view","admin.orders.manage","admin.orders.view","admin.payments.manage","admin.payments.view","admin.products.manage","admin.products.view","admin.promo.manage","admin.promotions.manage","admin.promotions.view","admin.purchases.manage","admin.purchases.receive","admin.reports.view","admin.reviews.manage","admin.reviews.view","admin.settings.manage","admin.shipping.manage","admin.shipping.view","admin.supplier_payments.manage","admin.suppliers.manage","admin.suppliers.view","admin.tax.manage","admin.tax.view","admin.testimonials.manage","admin.users.assign_roles","admin.users.manage","admin.users.view","panel.admin.access","panel.seller.access","pos.access","seller.analytics.view","seller.dashboard.view","seller.inventory.manage","seller.inventory.view","seller.orders.manage","seller.orders.view","seller.products.manage","seller.products.view","seller.uploads.manage"],"STAFF":["admin.backups.view","admin.categories.manage","admin.categories.view","admin.contact.manage","admin.contact.view","admin.dashboard.view","admin.help.view","admin.inventory.manage","admin.inventory.view","admin.newsletter.view","admin.orders.manage","admin.orders.view","admin.products.manage","admin.products.view","admin.purchases.receive","admin.reports.view","admin.reviews.manage","admin.reviews.view","admin.suppliers.view","panel.admin.access","pos.access"],"SELLER":["panel.seller.access","seller.analytics.view","seller.dashboard.view","seller.inventory.manage","seller.inventory.view","seller.orders.manage","seller.orders.view","seller.products.manage","seller.products.view","seller.uploads.manage"],"CUSTOMER":[]}'::jsonb;
  raw text;
  stored jsonb;
  known jsonb := '[]'::jsonb;
  r text;
  perms text[];
  computed jsonb := '{}'::jsonb;
BEGIN
  SELECT value INTO raw FROM "settings" WHERE key = 'rbac_role_permissions_v1';
  IF raw IS NOT NULL THEN
    BEGIN
      stored := raw::jsonb;
    EXCEPTION WHEN others THEN
      stored := NULL;
    END;
  END IF;
  IF stored IS NOT NULL AND jsonb_typeof(stored) <> 'object' THEN
    stored := NULL;
  END IF;
  IF stored IS NOT NULL AND jsonb_typeof(stored -> '__known') = 'array' THEN
    known := stored -> '__known';
  END IF;

  FOREACH r IN ARRAY ARRAY['ADMIN', 'STAFF', 'SELLER', 'CUSTOMER'] LOOP
    IF stored IS NULL OR NOT (stored ? r) THEN
      perms := ARRAY(SELECT jsonb_array_elements_text(defaults -> r));
    ELSE
      perms := ARRAY(
        SELECT DISTINCT el #>> '{}'
        FROM jsonb_array_elements(CASE WHEN jsonb_typeof(stored -> r) = 'array' THEN stored -> r ELSE '[]'::jsonb END) AS el
        WHERE jsonb_typeof(el) = 'string' AND (el #>> '{}') = ANY (catalog)
      );
      perms := perms || ARRAY(
        SELECT k FROM unnest(later) AS k
        WHERE NOT (known ? k)
          AND k IN (SELECT jsonb_array_elements_text(defaults -> r))
          AND NOT (k = ANY (perms))
      );
    END IF;
    computed := computed || jsonb_build_object(r, to_jsonb(ARRAY(SELECT DISTINCT p FROM unnest(perms) AS p ORDER BY 1)));
  END LOOP;

  INSERT INTO "app_roles" ("id", "key", "nameEn", "nameAr", "description", "color", "type", "permissions", "isSystem", "rank", "sortOrder", "createdAt", "updatedAt")
  VALUES
    ('role_super_admin', 'super_admin', 'Super Admin', 'مدير عام', 'Owner level. Always has every permission and can manage everyone.', '#c026d3', 'SUPER_ADMIN', catalog, true, 100, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('role_admin', 'admin', 'Admin', 'مدير', 'Runs the store day to day: orders, products, stock, people and settings.', '#7c3aed', 'ADMIN', ARRAY(SELECT jsonb_array_elements_text(computed -> 'ADMIN')), true, 80, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('role_staff', 'staff', 'Staff', 'موظف', 'Shop floor and back office: orders, products, stock and the POS.', '#059669', 'STAFF', ARRAY(SELECT jsonb_array_elements_text(computed -> 'STAFF')), true, 60, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('role_seller', 'seller', 'Seller', 'بائع', 'Marketplace seller with access to the seller portal only.', '#0284c7', 'SELLER', ARRAY(SELECT jsonb_array_elements_text(computed -> 'SELLER')), true, 40, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('role_customer', 'customer', 'Customer', 'عميل', 'Shops on the website. No access to the admin panel.', '#64748b', 'CUSTOMER', ARRAY(SELECT jsonb_array_elements_text(computed -> 'CUSTOMER')), true, 0, 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  ON CONFLICT ("key") DO NOTHING;

  UPDATE "users" AS u
  SET "roleId" = ar."id"
  FROM "app_roles" AS ar
  WHERE u."roleId" IS NULL
    AND ar."key" = lower(u."role"::text)
    AND ar."type" = u."role";
END
$roles$;
