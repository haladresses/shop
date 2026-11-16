"use client";
import { Suspense, use } from "react";
import PoDetail from "@/components/admin/purchasing/PoDetail";

export default function PurchaseOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Suspense fallback={<div className="flex justify-center py-16"><span className="spinner" /></div>}>
      <PoDetail id={id} />
    </Suspense>
  );
}
