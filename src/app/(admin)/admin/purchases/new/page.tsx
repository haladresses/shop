"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { LuChevronLeft } from "react-icons/lu";
import PoEditor, { emptyEditor, type EditorInitial } from "@/components/admin/purchasing/PoEditor";
import { poToEditor } from "@/components/admin/purchasing/PoDetail";
import { api, usePurchasingPerms, type SupplierOption } from "@/components/admin/purchasing/shared";
import type { PoDetailData } from "@/components/admin/purchasing/types";

export default function NewPurchaseOrderPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-16"><span className="spinner" /></div>}>
      <NewPurchaseOrder />
    </Suspense>
  );
}

/**
 * New purchase order.
 *   ?supplierId=<id>  start with this supplier
 *   ?from=<poId>      duplicate an existing order (items, prices, charges)
 */
function NewPurchaseOrder() {
  const sp = useSearchParams();
  const perms = usePurchasingPerms();
  const [initial, setInitial] = useState<EditorInitial | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    const from = sp.get("from");
    const supplierId = sp.get("supplierId");
    (async () => {
      if (from) {
        const d = await api<PoDetailData>(`/api/purchases/${from}`);
        if (d.success && d.data) {
          setInitial(poToEditor(d.data, true));
          setNote(`Copied from ${d.data.number} — check prices and quantities before placing it.`);
          return;
        }
      }
      const base = emptyEditor();
      if (supplierId) {
        const d = await api<{ supplier: SupplierOption & { isActive: boolean }; balance: { balance: number } }>(`/api/suppliers/${supplierId}`);
        if (d.success && d.data) {
          base.supplier = { ...d.data.supplier, balance: d.data.balance.balance };
        }
      }
      setInitial(base);
    })();
  }, [sp]);

  if (perms.ready && !perms.managePurchases) {
    return (
      <div className="admin-card p-10 text-center text-slate-600">
        You don&apos;t have permission to create purchase orders.
        <div className="mt-4">
          <Link href="/admin/purchases" className="admin-btn admin-btn-secondary">Back</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <Link href="/admin/purchases" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-1">
          <LuChevronLeft size={16} /> Purchase orders
        </Link>
        <h1 className="text-xl font-semibold text-slate-800">New purchase order</h1>
        {note && <p className="text-sm text-amber-700 mt-1">{note}</p>}
      </div>
      {initial ? <PoEditor initial={initial} /> : <div className="flex justify-center py-16"><span className="spinner" /></div>}
    </div>
  );
}
