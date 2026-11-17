"use client";
import { use } from "react";
import RoleEditor from "@/components/admin/access/RoleEditor";

export default function EditRolePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <RoleEditor key={id} id={id} />;
}
