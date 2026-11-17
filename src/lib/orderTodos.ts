import type { Prisma } from "@prisma/client";

// The order to-do lists on the Dashboard ("Waiting for you"). The Dashboard
// counts and the Orders list (/admin/orders?todo=<key>) use the same rule,
// so the number you tap always matches the list you get.

export type OrderTodo = "confirm" | "ship" | "transfer";

export const ORDER_TODOS: Record<OrderTodo, { label: string; where: Prisma.OrderWhereInput }> = {
  confirm: {
    label: "New orders to confirm",
    where: { status: "PENDING" },
  },
  ship: {
    label: "Online orders to pack and send",
    where: { status: { in: ["CONFIRMED", "PROCESSING"] }, source: "ONLINE" },
  },
  transfer: {
    label: "Bank transfers to check",
    where: { paymentStatus: "UNPAID", payments: { some: { method: "BANK_TRANSFER" } }, status: { notIn: ["CANCELLED", "REFUNDED"] } },
  },
};

export const isOrderTodo = (v: unknown): v is OrderTodo =>
  typeof v === "string" && Object.prototype.hasOwnProperty.call(ORDER_TODOS, v);
