"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { LuChevronLeft } from "react-icons/lu";
import PromotionEditor from "@/components/admin/promotions/PromotionEditor";
import { fetchJson } from "@/components/admin/promotions/shared";

export default function NewPromotionPage() {
  const [canManage, setCanManage] = useState<boolean | null>(null);

  useEffect(() => {
    fetchJson<{ permissions: string[] }>("/api/auth/me").then((d) => setCanManage(!!d.data?.permissions?.includes("admin.promotions.manage")));
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <Link href="/admin/promotions" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-1">
          <LuChevronLeft size={16} /> Promotions
        </Link>
        <h1 className="text-xl font-semibold text-slate-800">New promotion</h1>
      </div>
      {canManage === null ? (
        <div className="flex justify-center py-16">
          <span className="spinner" />
        </div>
      ) : canManage ? (
        <PromotionEditor canManage />
      ) : (
        <p className="admin-card p-6 text-sm text-slate-500">You don&apos;t have permission to create promotions.</p>
      )}
    </div>
  );
}
