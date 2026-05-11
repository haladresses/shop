export type OrderStatus = "processing" | "on-hold" | "delivered" | "cancelled";

export type Order = {
  orderId: string;
  createdAt: string;
  status: OrderStatus;
  total: string;
  title: string;
};