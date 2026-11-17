/**
 * Imports the old POS exports (Supplier.xls + Product List.xls, saved as JSON
 * in prisma/data/legacy-pos/) into the shop.
 *
 *   npm run db:import-legacy            (add --dry-run to only print the plan)
 *
 * Safe to run more than once: suppliers are matched by name, products by their
 * old Item Code / barcode, and anything already imported is skipped.
 *
 * - Suppliers: one per row, with the next SUP-#### code. The full original row
 *   is kept in `legacyData`.
 * - Products: names, Arabic names and categories come from catalog-map.txt.
 *   Each new product gets the old barcode, the Item Code as SKU, the selling
 *   price, the cost, its supplier and department, and one stock line holding
 *   the opening quantity (recorded in the stock history as an adjustment).
 * - Items that already exist on the website (MATCH lines) keep their name,
 *   photos and price; only empty fields are filled in.
 */
import { PrismaClient, Prisma, ProductDepartment } from "@prisma/client";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes("--dry-run");
const DATA_DIR = path.join(__dirname, "data", "legacy-pos");
const IMPORTED_AT = new Date().toISOString();
const PRODUCT_SOURCE = "Product List.xls (old POS)";
const SUPPLIER_SOURCE = "Supplier.xls (old POS)";

type Row = Record<string, string>;

// ── Categories ──────────────────────────────────────────────────────────────
// New categories the old catalogue needs (the existing ones are reused).
const NEW_CATEGORIES: { slug: string; nameEn: string; nameAr: string }[] = [
  { slug: "boys-wear", nameEn: "Boys' Wear", nameAr: "ملابس الأولاد" },
  { slug: "boys-accessories", nameEn: "Boys' Accessories", nameAr: "إكسسوارات الأولاد" },
  { slug: "national-day", nameEn: "National Day", nameAr: "العيد الوطني" },
  { slug: "gifts", nameEn: "Gifts & Souvenirs", nameAr: "هدايا وتذكارات" },
  { slug: "sleepwear", nameEn: "Sleepwear", nameAr: "ملابس النوم" },
  { slug: "school-uniforms", nameEn: "School Uniforms", nameAr: "الزي المدرسي" },
  { slug: "footwear", nameEn: "Footwear", nameAr: "الأحذية" },
  { slug: "innerwear", nameEn: "Innerwear & Socks", nameAr: "الملابس الداخلية والجوارب" },
];
// Existing categories whose names should describe what they now hold.
const CATEGORY_RENAMES: Record<string, { nameEn: string; nameAr: string }> = {
  "womens-dresses": { nameEn: "Women's Wear", nameAr: "ملابس نسائية" },
  "girls-dresses": { nameEn: "Girls' Wear", nameAr: "ملابس البنات" },
  "complementary-clothin": { nameEn: "Complementary Clothing", nameAr: "اللبس المُكمل" },
};
const CATEGORY_IMAGE = "/images/placeholders/product.webp";

// ── Suppliers ───────────────────────────────────────────────────────────────
// Tidy display names (the original spelling stays in legacyData) and the
// country each name points to; "OM" when the name doesn't say.
const SUPPLIER_INFO: Record<string, { nameEn: string; country?: string }> = {
  "china mart": { nameEn: "China Mart" },
  "abu maryam": { nameEn: "Abu Maryam" },
  afaaq: { nameEn: "Afaaq" },
  "al marah": { nameEn: "Al Marah" },
  araimi: { nameEn: "Araimi" },
  "bait alzari": { nameEn: "Bait Al Zari" },
  "corner shop": { nameEn: "Corner Shop" },
  "cotton rose": { nameEn: "Cotton Rose" },
  dubai: { nameEn: "Dubai", country: "AE" },
  hala: { nameEn: "Hala" },
  "homayoun kabir": { nameEn: "Homayoun Kabir" },
  ibrahim: { nameEn: "Ibrahim" },
  india: { nameEn: "India", country: "IN" },
  iran: { nameEn: "Iran", country: "IR" },
  kuwait: { nameEn: "Kuwait", country: "KW" },
  "kuwait 2025": { nameEn: "Kuwait 2025", country: "KW" },
  "kuwait may 2022": { nameEn: "Kuwait May 2022", country: "KW" },
  "kuwiti one emran": { nameEn: "Kuwaiti One Emran", country: "KW" },
  mattrah: { nameEn: "Mattrah" },
  "mattrah al ruaa": { nameEn: "Mattrah Al Ruaa" },
  mola: { nameEn: "Mola" },
  "muttrah dresses": { nameEn: "Muttrah Dresses" },
  "my choice scarf kuwait": { nameEn: "My Choice Scarf Kuwait", country: "KW" },
  oman: { nameEn: "Oman" },
  saudi: { nameEn: "Saudi", country: "SA" },
  "shamirat gulam new": { nameEn: "Shamirat Gulam New" },
  turkey: { nameEn: "Turkey", country: "TR" },
  urban: { nameEn: "Urban" },
  "yaqoob ahmed almusalhi trad": { nameEn: "Yaqoob Ahmed Almusalhi Trading" },
  zubair: { nameEn: "Zubair" },
};
const INDUSTRY_LABEL: Record<string, string> = { boys: "Boys", ladies: "Ladies", girls: "Girls" };

const DEPARTMENTS: Record<string, ProductDepartment> = {
  Ladies: "LADIES",
  Girls: "GIRLS",
  Boys: "BOYS",
  Baby: "BABY",
  Gifts: "GIFTS",
};

/** Supplier names as written in the product list ("trad." vs "trad"). */
const supplierKey = (name: string) => name.trim().toLowerCase().replace(/[.\s]+$/, "");
const money = (v: string) => Math.round(parseFloat(v || "0") * 1000) / 1000;
const slugify = (text: string) =>
  text
    .toLowerCase()
    .replace(/×/g, "x")
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

type MapEntry =
  | { kind: "match"; slug: string }
  | { kind: "new"; category: string; nameEn: string; nameAr: string };

function readMap(): Map<string, MapEntry> {
  const map = new Map<string, MapEntry>();
  const text = fs.readFileSync(path.join(DATA_DIR, "catalog-map.txt"), "utf8");
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const [code, second, third, fourth] = line.split("|");
    if (map.has(code)) throw new Error(`catalog-map.txt lists ${code} twice`);
    map.set(code, second === "MATCH" ? { kind: "match", slug: third } : { kind: "new", category: second, nameEn: third, nameAr: fourth });
  }
  return map;
}

async function nextSupplierCode(tx: Prisma.TransactionClient): Promise<string> {
  const row = await tx.documentSequence.upsert({
    where: { key: "SUP" },
    create: { key: "SUP", value: 1 },
    update: { value: { increment: 1 } },
  });
  return `SUP-${String(row.value).padStart(4, "0")}`;
}

/** Is this barcode already used by any product or option (other than `exceptProductId`)? */
async function barcodeTaken(tx: Prisma.TransactionClient, code: string, exceptProductId?: string) {
  const [p, v] = await Promise.all([
    tx.product.findFirst({ where: { barcode: code, ...(exceptProductId ? { id: { not: exceptProductId } } : {}) }, select: { id: true } }),
    tx.productVariant.findFirst({ where: { barcode: code }, select: { id: true } }),
  ]);
  return Boolean(p || v);
}

async function uniqueSlug(tx: Prisma.TransactionClient, base: string) {
  let slug = base || "item";
  for (let n = 2; await tx.product.findUnique({ where: { slug }, select: { id: true } }); n++) slug = `${base}-${n}`;
  return slug;
}

/** One stock line (no colour / size) holding the opening quantity, with its history entry. */
async function addOpeningStock(tx: Prisma.TransactionClient, productId: string, row: Row, qty: number, cost: number | null) {
  const variant = await tx.productVariant.create({
    data: {
      productId,
      isActive: true,
      inventory: { create: { quantity: qty, lowStockAlert: 5 } },
    },
    include: { inventory: true },
  });
  if (qty > 0 && variant.inventory) {
    await tx.inventoryTransaction.create({
      data: {
        inventoryId: variant.inventory.id,
        type: "ADJUSTMENT",
        quantity: qty,
        note: `Opening stock from the old POS (${PRODUCT_SOURCE})`,
        reference: `OLD-POS ${row["Item Code"]}`,
        unitCost: cost ?? undefined,
        balanceAfter: qty,
      },
    });
  }
}

async function main() {
  const suppliersRaw: Row[] = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "suppliers.json"), "utf8"));
  const productsRaw: Row[] = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "products.json"), "utf8"));
  const map = readMap();
  for (const r of productsRaw) if (!map.has(r["Item Code"])) throw new Error(`catalog-map.txt has no line for ${r["Item Code"]}`);

  const report = {
    categoriesCreated: [] as string[],
    categoriesRenamed: [] as string[],
    suppliersCreated: 0,
    suppliersSkipped: 0,
    productsCreated: 0,
    productsSkipped: [] as string[],
    productsCompleted: [] as string[],
    hiddenNoPrice: [] as string[],
    priceDifferences: [] as string[],
    stockKept: [] as string[],
    barcodeConflicts: [] as string[],
  };

  await prisma.$transaction(
    async (tx) => {
      // 1. Categories.
      const existingCats = await tx.category.findMany({ select: { id: true, slug: true, nameEn: true, nameAr: true, sortOrder: true } });
      let sortOrder = Math.max(0, ...existingCats.map((c) => c.sortOrder)) + 1;
      for (const c of existingCats) {
        const rename = CATEGORY_RENAMES[c.slug];
        const nameEn = (rename?.nameEn ?? c.nameEn).trim();
        const nameAr = (rename?.nameAr ?? c.nameAr).trim();
        if (nameEn !== c.nameEn || nameAr !== c.nameAr) {
          await tx.category.update({ where: { id: c.id }, data: { nameEn, nameAr } });
          report.categoriesRenamed.push(`${c.nameEn.trim()} -> ${nameEn}`);
        }
      }
      for (const c of NEW_CATEGORIES) {
        if (existingCats.some((e) => e.slug === c.slug)) continue;
        await tx.category.create({ data: { ...c, image: CATEGORY_IMAGE, isActive: true, sortOrder: sortOrder++ } });
        report.categoriesCreated.push(c.nameEn);
      }
      const categoryId = new Map((await tx.category.findMany({ select: { id: true, slug: true } })).map((c) => [c.slug, c.id]));

      // 2. Suppliers.
      const supplierId = new Map<string, string>();
      for (const s of await tx.supplier.findMany({ select: { id: true, nameEn: true, legacyData: true } })) {
        const original = (s.legacyData as { row?: Row } | null)?.row?.Name;
        supplierId.set(supplierKey(original ?? s.nameEn), s.id);
        supplierId.set(supplierKey(s.nameEn), s.id);
      }
      for (const row of suppliersRaw) {
        const key = supplierKey(row.Name);
        const info = SUPPLIER_INFO[key];
        if (!info) throw new Error(`No display name for supplier "${row.Name}"`);
        if (supplierId.has(key) || supplierId.has(supplierKey(info.nameEn))) {
          report.suppliersSkipped++;
          continue;
        }
        const credit = money(row["Credit Amt."]);
        const created = await tx.supplier.create({
          data: {
            code: await nextSupplierCode(tx),
            nameEn: info.nameEn,
            category: INDUSTRY_LABEL[(row.Industry || "").toLowerCase()] ?? null,
            country: info.country ?? "OM",
            creditLimit: credit > 0 ? credit : null,
            isActive: true,
            legacyData: { source: SUPPLIER_SOURCE, importedAt: IMPORTED_AT, row },
          },
        });
        supplierId.set(key, created.id);
        report.suppliersCreated++;
      }

      // 3. Products.
      for (const row of productsRaw) {
        const code = row["Item Code"];
        const entry = map.get(code)!;
        const price = money(row.OutPrice);
        const costValue = money(row.Cost);
        const cost = costValue > 0 ? costValue : null;
        const qty = Math.max(0, Math.round(parseFloat(row["Beginning Qty"] || "0")));
        const department = DEPARTMENTS[row["Main Category"]] ?? null;
        const supplier = row["POS Supplier"] ? supplierId.get(supplierKey(row["POS Supplier"])) ?? null : null;
        if (row["POS Supplier"] && !supplier) throw new Error(`Unknown supplier "${row["POS Supplier"]}" on ${code}`);
        const legacyData = { source: PRODUCT_SOURCE, importedAt: IMPORTED_AT, row } as Prisma.InputJsonValue;
        const barcode = row.Barcode || null;

        if (entry.kind === "match") {
          const p = await tx.product.findUnique({
            where: { slug: entry.slug },
            include: { variants: { select: { id: true } } },
          });
          if (!p) throw new Error(`MATCH target "${entry.slug}" for ${code} does not exist`);
          if (p.legacyData) { report.productsSkipped.push(`${code} (already completed)`); continue; }
          const data: Prisma.ProductUncheckedUpdateInput = { legacyData };
          if (!p.sku && !(await tx.product.findFirst({ where: { sku: code }, select: { id: true } }))) data.sku = code;
          if (!p.barcode && barcode) {
            if (await barcodeTaken(tx, barcode, p.id)) report.barcodeConflicts.push(`${code} ${barcode}`);
            else data.barcode = barcode;
          }
          if (p.costPrice == null && cost != null) data.costPrice = cost;
          if (!p.supplierId && supplier) data.supplierId = supplier;
          if (!p.department && department) data.department = department;
          await tx.product.update({ where: { id: p.id }, data });
          if (p.variants.length === 0) await addOpeningStock(tx, p.id, row, qty, cost);
          else report.stockKept.push(`${p.nameEn} (kept the website stock; old POS had ${qty})`);
          if (Number(p.basePrice) !== price) report.priceDifferences.push(`${p.nameEn}: website ${Number(p.basePrice).toFixed(3)}, old POS ${price.toFixed(3)} (kept website price)`);
          report.productsCompleted.push(p.nameEn);
          continue;
        }

        // New product. Skip it when it was already imported.
        const already = await tx.product.findFirst({
          where: { OR: [{ sku: code }, ...(barcode ? [{ barcode }] : [])] },
          select: { id: true },
        });
        if (already) { report.productsSkipped.push(`${code} ${entry.nameEn}`); continue; }
        const catId = categoryId.get(entry.category);
        if (!catId) throw new Error(`Unknown category "${entry.category}" on ${code}`);
        let productBarcode = barcode;
        if (barcode && (await barcodeTaken(tx, barcode))) {
          report.barcodeConflicts.push(`${code} ${barcode}`);
          productBarcode = null;
        }
        const hasPrice = price > 0;
        if (!hasPrice) report.hiddenNoPrice.push(`${code} ${entry.nameEn}`);
        const created = await tx.product.create({
          data: {
            nameEn: entry.nameEn,
            nameAr: entry.nameAr,
            slug: await uniqueSlug(tx, slugify(entry.nameEn)),
            categoryId: catId,
            // A zero price can't be sold; the item stays hidden until it is priced.
            basePrice: hasPrice ? price : 0,
            costPrice: cost,
            sku: code,
            barcode: productBarcode,
            isActive: hasPrice,
            isFeatured: false,
            isNew: false,
            isBestSeller: false,
            supplierId: supplier,
            department,
            legacyData,
          },
        });
        await addOpeningStock(tx, created.id, row, qty, cost);
        report.productsCreated++;
      }

      if (DRY_RUN) throw new Error("__DRY_RUN__");
    },
    { timeout: 300_000, maxWait: 30_000 },
  ).catch((e) => {
    if (e instanceof Error && e.message === "__DRY_RUN__") {
      console.log("Dry run: nothing was saved.");
      return;
    }
    throw e;
  });

  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
