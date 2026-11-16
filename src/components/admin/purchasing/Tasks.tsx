"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  LuBanknote,
  LuCalendarClock,
  LuCheck,
  LuCircleCheck,
  LuClipboardList,
  LuListTodo,
  LuMessageCircle,
  LuPencil,
  LuPhone,
  LuPlus,
  LuTrash2,
  LuTruck,
  LuUsers,
} from "react-icons/lu";
import AdminModal from "@/components/admin/AdminModal";
import { TASK_PRIORITY_LABEL, TASK_TYPES, TASK_TYPE_LABEL } from "@/lib/purchaseCalc";
import { Empty, Field, SupplierPicker, addDaysKey, api, fmtDate, todayKey, type SupplierOption } from "./shared";

export type Task = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  priority: string;
  status: "OPEN" | "IN_PROGRESS" | "DONE";
  dueDate: string | null;
  overdue: boolean;
  completedAt: string | null;
  createdAt: string;
  supplier: { id: string; code: string; nameEn: string; nameAr: string | null } | null;
  purchaseOrder: { id: string; number: string } | null;
  assignee: { id: string; name: string } | null;
};

type Assignee = { id: string; name: string; isMe: boolean };

const TYPE_ICON: Record<string, React.ElementType> = {
  TASK: LuListTodo,
  CALL: LuPhone,
  FOLLOW_UP: LuMessageCircle,
  PAYMENT: LuBanknote,
  DELIVERY: LuTruck,
  MEETING: LuUsers,
};

const FILTERS = [
  { id: "open", label: "Open" },
  { id: "overdue", label: "Overdue" },
  { id: "today", label: "Due today" },
  { id: "week", label: "This week" },
  { id: "done", label: "Done" },
  { id: "all", label: "All" },
] as const;
type FilterId = (typeof FILTERS)[number]["id"];

/** Task list with filters, quick-complete and create/edit. */
export function TaskList({
  supplierId,
  purchaseOrderId,
  supplierForNew,
  canManage,
  compact,
  onChanged,
}: {
  supplierId?: string;
  purchaseOrderId?: string;
  /** Pre-filled supplier for new tasks. */
  supplierForNew?: { id: string; nameEn: string; code: string } | null;
  canManage: boolean;
  compact?: boolean;
  onChanged?: () => void;
}) {
  const [filter, setFilter] = useState<FilterId>("open");
  const [mine, setMine] = useState(false);
  const [items, setItems] = useState<Task[]>([]);
  const [counts, setCounts] = useState<{ open: number; overdue: number; dueToday: number; done: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Task | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const p = new URLSearchParams();
    if (supplierId) p.set("supplierId", supplierId);
    if (purchaseOrderId) p.set("purchaseOrderId", purchaseOrderId);
    if (filter === "done") p.set("status", "done");
    else if (filter === "all") p.set("status", "all");
    else p.set("status", "open");
    if (filter === "overdue") p.set("due", "overdue");
    if (filter === "today") p.set("due", "today");
    if (filter === "week") p.set("due", "week");
    if (mine) p.set("assignee", "me");
    api<{ items: Task[]; counts: typeof counts }>(`/api/supplier-tasks?${p}`).then((d) => {
      setItems(d.data?.items ?? []);
      setCounts(d.data?.counts ?? null);
      setLoading(false);
    });
  }, [supplierId, purchaseOrderId, filter, mine]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleDone = async (t: Task) => {
    const next = t.status === "DONE" ? "OPEN" : "DONE";
    setItems((list) => list.map((x) => (x.id === t.id ? { ...x, status: next } : x)));
    const d = await api(`/api/supplier-tasks/${t.id}`, { method: "PATCH", body: { status: next } });
    if (!d.success) toast.error(d.error || "Could not update the task");
    else if (next === "DONE") toast.success("Task completed");
    load();
    onChanged?.();
  };

  const remove = async (t: Task) => {
    if (!confirm(`Delete the task "${t.title}"?`)) return;
    const d = await api(`/api/supplier-tasks/${t.id}`, { method: "DELETE" });
    if (!d.success) return toast.error(d.error || "Could not delete");
    load();
    onChanged?.();
  };

  return (
    <div className="admin-card">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-slate-100">
        <div className="flex flex-wrap items-center gap-1.5">
          {FILTERS.map((f) => {
            const n = f.id === "open" ? counts?.open : f.id === "overdue" ? counts?.overdue : f.id === "today" ? counts?.dueToday : null;
            return (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  filter === f.id ? (f.id === "overdue" ? "bg-rose-600 text-white" : "bg-slate-800 text-white") : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {f.label}
                {n ? <span className="ml-1 opacity-80">{n}</span> : null}
              </button>
            );
          })}
          <label className="ml-1 inline-flex items-center gap-1.5 text-xs text-slate-600">
            <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} className="rounded" /> Assigned to me
          </label>
        </div>
        {canManage && (
          <button onClick={() => setCreating(true)} className="admin-btn admin-btn-primary !py-1.5">
            <LuPlus size={15} /> New task
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><span className="spinner" /></div>
      ) : items.length === 0 ? (
        <Empty icon={LuClipboardList} title={filter === "done" ? "No completed tasks" : "Nothing to do here"}>
          {canManage && filter !== "done" && "Add follow-ups like “call about late delivery” or “pay invoice by Thursday”."}
        </Empty>
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map((t) => {
            const Icon = TYPE_ICON[t.type] ?? LuListTodo;
            const pr = TASK_PRIORITY_LABEL[t.priority] ?? TASK_PRIORITY_LABEL.NORMAL;
            const done = t.status === "DONE";
            return (
              <li key={t.id} className={`flex items-start gap-3 px-4 py-3 ${done ? "bg-slate-50/50" : ""}`}>
                <button
                  onClick={() => canManage && toggleDone(t)}
                  disabled={!canManage}
                  className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                    done ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-300 hover:border-emerald-500"
                  }`}
                  aria-label={done ? "Mark as open" : "Mark as done"}
                >
                  {done && <LuCheck size={14} />}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Icon size={14} className="text-slate-400 shrink-0" />
                    <p className={`font-medium ${done ? "line-through text-slate-400" : "text-slate-800"}`}>{t.title}</p>
                    {t.priority !== "NORMAL" && <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${pr.badge}`}>{pr.en}</span>}
                    {t.status === "IN_PROGRESS" && <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold bg-indigo-50 text-indigo-700">In progress</span>}
                  </div>
                  {t.description && !compact && <p className="text-sm text-slate-500 mt-0.5 whitespace-pre-line">{t.description}</p>}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-slate-500">
                    <span>{TASK_TYPE_LABEL[t.type] ?? t.type}</span>
                    {t.dueDate && (
                      <span className={`inline-flex items-center gap-1 ${t.overdue && !done ? "text-rose-600 font-semibold" : ""}`}>
                        <LuCalendarClock size={12} /> {t.overdue && !done ? "Overdue · " : ""}
                        {fmtDate(t.dueDate)}
                      </span>
                    )}
                    {t.supplier && !supplierId && (
                      <Link href={`/admin/suppliers/${t.supplier.id}`} className="text-indigo-600 hover:underline">{t.supplier.nameEn}</Link>
                    )}
                    {t.purchaseOrder && !purchaseOrderId && (
                      <Link href={`/admin/purchases/${t.purchaseOrder.id}`} className="text-indigo-600 hover:underline">{t.purchaseOrder.number}</Link>
                    )}
                    {t.assignee && <span>→ {t.assignee.name}</span>}
                    {done && t.completedAt && <span className="inline-flex items-center gap-1 text-emerald-600"><LuCircleCheck size={12} /> {fmtDate(t.completedAt)}</span>}
                  </div>
                </div>
                {canManage && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => setEditing(t)} className="p-1.5 text-slate-400 hover:text-slate-700" aria-label="Edit"><LuPencil size={15} /></button>
                    <button onClick={() => remove(t)} className="p-1.5 text-slate-400 hover:text-rose-600" aria-label="Delete"><LuTrash2 size={15} /></button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <TaskModal
        open={creating || !!editing}
        task={editing}
        supplier={supplierForNew ?? null}
        purchaseOrderId={purchaseOrderId}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        onSaved={() => {
          load();
          onChanged?.();
        }}
      />
    </div>
  );
}

let assigneeCache: Promise<Assignee[]> | null = null;

export function TaskModal({
  open,
  task,
  supplier,
  purchaseOrderId,
  onClose,
  onSaved,
}: {
  open: boolean;
  task: Task | null;
  supplier: { id: string; nameEn: string; code: string } | null;
  purchaseOrderId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("TASK");
  const [priority, setPriority] = useState("NORMAL");
  const [status, setStatus] = useState("OPEN");
  const [dueDate, setDueDate] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [pickedSupplier, setPickedSupplier] = useState<SupplierOption | null>(null);
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!open) return;
    if (!assigneeCache) assigneeCache = api<Assignee[]>("/api/supplier-tasks/assignees").then((d) => d.data ?? []);
    assigneeCache.then(setAssignees);
    setTitle(task?.title ?? "");
    setDescription(task?.description ?? "");
    setType(task?.type ?? "TASK");
    setPriority(task?.priority ?? "NORMAL");
    setStatus(task?.status ?? "OPEN");
    setDueDate(task?.dueDate ?? "");
    setAssigneeId(task?.assignee?.id ?? "");
    setPickedSupplier(null);
    setErr("");
  }, [open, task]);

  const fixedSupplier = task?.supplier ?? supplier;

  const submit = async () => {
    if (!title.trim()) return setErr("Give the task a title.");
    setSaving(true);
    const body = {
      title: title.trim(),
      description: description || null,
      type,
      priority,
      status,
      dueDate: dueDate || null,
      assigneeId: assigneeId || null,
      ...(task ? {} : { supplierId: fixedSupplier?.id ?? pickedSupplier?.id ?? null, purchaseOrderId: purchaseOrderId ?? null }),
    };
    const d = await api(task ? `/api/supplier-tasks/${task.id}` : "/api/supplier-tasks", { method: task ? "PATCH" : "POST", body });
    setSaving(false);
    if (!d.success) return setErr(d.error || "Could not save the task.");
    toast.success(task ? "Task updated" : "Task added");
    onSaved();
    onClose();
  };

  const today = todayKey();
  const presets = [
    { label: "Today", v: today },
    { label: "Tomorrow", v: addDaysKey(today, 1) },
    { label: "In 3 days", v: addDaysKey(today, 3) },
    { label: "Next week", v: addDaysKey(today, 7) },
  ];

  return (
    <AdminModal
      open={open}
      onClose={onClose}
      title={task ? "Edit task" : "New task"}
      footer={
        <>
          <button onClick={onClose} className="admin-btn admin-btn-secondary">Cancel</button>
          <button onClick={submit} disabled={saving} className="admin-btn admin-btn-primary">{saving ? "Saving…" : task ? "Save" : "Add task"}</button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="What needs doing?">
          <input autoFocus className="admin-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Call about the late fabric delivery" />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Type">
            <select className="admin-input admin-select" value={type} onChange={(e) => setType(e.target.value)}>
              {TASK_TYPES.map((t) => (
                <option key={t} value={t}>{TASK_TYPE_LABEL[t]}</option>
              ))}
            </select>
          </Field>
          <Field label="Priority">
            <select className="admin-input admin-select" value={priority} onChange={(e) => setPriority(e.target.value)}>
              {Object.entries(TASK_PRIORITY_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v.en}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Due">
          <div className="flex flex-wrap items-center gap-2">
            <input type="date" className="admin-input !w-44" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            {presets.map((p) => (
              <button key={p.label} type="button" onClick={() => setDueDate(p.v)} className={`px-2.5 py-1.5 rounded-lg text-xs ${dueDate === p.v ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                {p.label}
              </button>
            ))}
            {dueDate && <button type="button" onClick={() => setDueDate("")} className="text-xs text-slate-400 hover:text-slate-600">Clear</button>}
          </div>
        </Field>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Assign to">
            <select className="admin-input admin-select" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
              <option value="">Unassigned</option>
              {assignees.map((a) => (
                <option key={a.id} value={a.id}>{a.name}{a.isMe ? " (me)" : ""}</option>
              ))}
            </select>
          </Field>
          {task && (
            <Field label="Status">
              <select className="admin-input admin-select" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="OPEN">Open</option>
                <option value="IN_PROGRESS">In progress</option>
                <option value="DONE">Done</option>
              </select>
            </Field>
          )}
        </div>
        {fixedSupplier ? (
          <p className="text-sm text-slate-500">Supplier: <span className="font-medium text-slate-700">{fixedSupplier.nameEn}</span></p>
        ) : (
          !task && (
            <Field label="Supplier (optional)">
              <SupplierPicker value={pickedSupplier} onChange={setPickedSupplier} placeholder="Not linked to a supplier" />
            </Field>
          )
        )}
        <Field label="Details">
          <textarea className="admin-input" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        {err && <p className="text-sm text-rose-600">{err}</p>}
      </div>
    </AdminModal>
  );
}
