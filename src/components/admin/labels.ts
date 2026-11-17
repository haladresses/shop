// Plain words for the status codes the API uses, so staff never see raw
// values like "PENDING" or "BANK_TRANSFER" on screen.

/** "BANK_TRANSFER" -> "Bank transfer", "super_admin" -> "Super admin". */
export const humanize = (code: string | null | undefined): string => {
  if (!code) return "-";
  const words = code.replace(/[_-]+/g, " ").trim().toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  PROCESSING: "Processing",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  PAID: "Paid",
  UNPAID: "Unpaid",
  PARTIAL: "Partly paid",
  PENDING: "Pending",
  FAILED: "Failed",
  REFUNDED: "Refunded",
};

export const orderStatusLabel = (s: string) => ORDER_STATUS_LABELS[s] ?? humanize(s);
export const paymentStatusLabel = (s: string) => PAYMENT_STATUS_LABELS[s] ?? humanize(s);
