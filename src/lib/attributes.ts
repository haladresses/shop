export type AttributeType =
  | "TEXT"
  | "NUMBER"
  | "SELECT"
  | "MULTISELECT"
  | "COLOR"
  | "BOOLEAN";

export type AttributeOption = {
  value: string;
  labelEn: string;
  labelAr: string;
  hex?: string;
};

/** The category a definition was inherited from (set only for parent-category fields). */
export type AttributeSource = { id: string; nameEn: string; nameAr: string };

export type CategoryAttribute = {
  id?: string;
  key: string;
  labelEn: string;
  labelAr: string;
  type: AttributeType;
  options: AttributeOption[];
  unit?: string | null;
  placeholder?: string | null;
  isRequired: boolean;
  isFilterable: boolean;
  sortOrder: number;
  inheritedFrom?: AttributeSource | null;
};

/** Raw value stored on a product for a given attribute key. */
export type AttributeValue = string | number | boolean | string[] | null | undefined;

export type ProductAttributes = Record<string, AttributeValue>;

/** A specification that belongs to one product only (not defined on its category). */
export type CustomSpec = {
  labelEn: string;
  labelAr: string;
  valueEn: string;
  valueAr: string;
};

export type AttributeTypeMeta = {
  value: AttributeType;
  label: string;
  labelAr: string;
  description: string;
  example: string;
};

export const ATTRIBUTE_TYPE_OPTIONS: AttributeTypeMeta[] = [
  { value: "SELECT", label: "Single choice", labelAr: "اختيار واحد", description: "Pick one option from a list.", example: "Length: Maxi" },
  { value: "MULTISELECT", label: "Multiple choice", labelAr: "اختيار متعدد", description: "Pick several options at once.", example: "Occasion: Evening, Wedding" },
  { value: "TEXT", label: "Text", labelAr: "نص", description: "Free text typed for each product.", example: "Brand: Hala" },
  { value: "NUMBER", label: "Number", labelAr: "رقم", description: "A number with an optional unit.", example: "Length: 140 cm" },
  { value: "COLOR", label: "Colour swatches", labelAr: "ألوان", description: "Options shown as colour circles.", example: "Colour family: Black" },
  { value: "BOOLEAN", label: "Yes / No", labelAr: "نعم / لا", description: "A simple yes or no answer.", example: "Has pockets: Yes" },
];

export const attributeTypeMeta = (type: AttributeType): AttributeTypeMeta =>
  ATTRIBUTE_TYPE_OPTIONS.find((t) => t.value === type) ?? ATTRIBUTE_TYPE_OPTIONS[2];

export const needsOptions = (type: AttributeType): boolean =>
  type === "SELECT" || type === "MULTISELECT" || type === "COLOR";

/** Lowercase snake_case identifier made from a label ("Sleeve Length" -> "sleeve_length"). */
export const slugifyKey = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/(^_|_$)/g, "");

/**
 * A key derived from `label` that is not already in `taken`. Labels with no
 * Latin characters (e.g. Arabic only) fall back to a generic "field" base.
 */
export function uniqueKey(label: string, taken: Set<string>, fallback = "field"): string {
  const base = slugifyKey(label) || fallback;
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}_${n}`)) n++;
  return `${base}_${n}`;
}

export const isEmptyAttributeValue = (v: AttributeValue) =>
  v == null || v === "" || (Array.isArray(v) && v.length === 0);

/** Convert an arbitrary API value into a typed CategoryAttribute. */
export function normalizeAttribute(raw: unknown, index = 0): CategoryAttribute {
  const o = (raw ?? {}) as Record<string, unknown>;
  const type = (o.type as AttributeType) || "TEXT";
  const rawOptions = Array.isArray(o.options) ? o.options : [];
  const options: AttributeOption[] = rawOptions.map((opt) => {
    const op = (opt ?? {}) as Record<string, unknown>;
    return {
      value: String(op.value ?? ""),
      labelEn: String(op.labelEn ?? op.value ?? ""),
      labelAr: String(op.labelAr ?? op.value ?? ""),
      hex: op.hex ? String(op.hex) : undefined,
    };
  });
  const src = o.inheritedFrom as Record<string, unknown> | null | undefined;
  return {
    id: o.id ? String(o.id) : undefined,
    key: String(o.key ?? ""),
    labelEn: String(o.labelEn ?? ""),
    labelAr: String(o.labelAr ?? ""),
    type,
    options,
    unit: o.unit != null ? String(o.unit) : null,
    placeholder: o.placeholder != null ? String(o.placeholder) : null,
    isRequired: Boolean(o.isRequired),
    isFilterable: Boolean(o.isFilterable),
    sortOrder: typeof o.sortOrder === "number" ? o.sortOrder : index,
    inheritedFrom: src && src.id
      ? { id: String(src.id), nameEn: String(src.nameEn ?? ""), nameAr: String(src.nameAr ?? "") }
      : null,
  };
}

export function normalizeAttributes(raw: unknown): CategoryAttribute[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((a, i) => normalizeAttribute(a, i)).filter((a) => a.key);
}

/** Parse the product's `customSpecs` JSON into typed rows, dropping malformed ones. */
export function normalizeCustomSpecs(raw: unknown): CustomSpec[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r) => {
      const o = (r ?? {}) as Record<string, unknown>;
      return {
        labelEn: String(o.labelEn ?? ""),
        labelAr: String(o.labelAr ?? ""),
        valueEn: String(o.valueEn ?? ""),
        valueAr: String(o.valueAr ?? ""),
      };
    })
    .filter((s) => (s.labelEn || s.labelAr) && (s.valueEn || s.valueAr));
}

/**
 * Resolve a stored attribute value into a human-readable display string in the
 * requested language. Handles select/multiselect option label lookups, booleans,
 * and number units.
 */
export function formatAttributeValue(
  attr: CategoryAttribute,
  value: AttributeValue,
  isArabic: boolean
): string {
  if (value == null || value === "") return "";

  const labelOf = (v: string) => {
    const opt = attr.options.find((o) => o.value === v);
    if (!opt) return v;
    return (isArabic ? opt.labelAr : opt.labelEn) || opt.value;
  };

  switch (attr.type) {
    case "BOOLEAN":
      return value ? (isArabic ? "نعم" : "Yes") : (isArabic ? "لا" : "No");
    case "SELECT":
    case "COLOR":
      return labelOf(String(value));
    case "MULTISELECT":
      return Array.isArray(value) ? value.map(labelOf).join(isArabic ? "، " : ", ") : labelOf(String(value));
    case "NUMBER":
      return attr.unit ? `${value} ${attr.unit}` : String(value);
    default:
      return String(value);
  }
}

/**
 * Fetch the attribute definitions for a category (client-side). By default
 * this is the effective set a product sees: fields inherited from parent
 * categories first, then the category's own.
 */
export async function fetchCategoryAttributes(
  categoryId: string,
  signal?: AbortSignal,
  { effective = true }: { effective?: boolean } = {}
): Promise<CategoryAttribute[]> {
  try {
    const qs = effective ? "?scope=effective" : "";
    const res = await fetch(`/api/categories/${categoryId}/attributes${qs}`, { signal, cache: "no-store" });
    const json = await res.json();
    if (!json.success) return [];
    return normalizeAttributes(json.data);
  } catch {
    return [];
  }
}
