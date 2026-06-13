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
};

/** Raw value stored on a product for a given attribute key. */
export type AttributeValue = string | number | boolean | string[] | null | undefined;

export type ProductAttributes = Record<string, AttributeValue>;

export const ATTRIBUTE_TYPE_OPTIONS: { value: AttributeType; label: string }[] = [
  { value: "TEXT", label: "Text" },
  { value: "NUMBER", label: "Number" },
  { value: "SELECT", label: "Select (single)" },
  { value: "MULTISELECT", label: "Multi-select" },
  { value: "COLOR", label: "Color" },
  { value: "BOOLEAN", label: "Yes / No" },
];

export const needsOptions = (type: AttributeType): boolean =>
  type === "SELECT" || type === "MULTISELECT" || type === "COLOR";

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
  };
}

export function normalizeAttributes(raw: unknown): CategoryAttribute[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((a, i) => normalizeAttribute(a, i)).filter((a) => a.key);
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

/** Fetch the attribute definitions for a category (client-side). */
export async function fetchCategoryAttributes(
  categoryId: string,
  signal?: AbortSignal
): Promise<CategoryAttribute[]> {
  try {
    const res = await fetch(`/api/categories/${categoryId}/attributes`, { signal });
    const json = await res.json();
    if (!json.success) return [];
    return normalizeAttributes(json.data);
  } catch {
    return [];
  }
}
