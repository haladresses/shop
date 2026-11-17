"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  LuDatabaseBackup,
  LuDownload,
  LuTrash2,
  LuUpload,
  LuRotateCcw,
  LuCheck,
  LuTriangleAlert,
  LuShieldAlert,
  LuHardDriveDownload,
} from "react-icons/lu";
import AdminModal from "./AdminModal";
import { humanize } from "@/components/admin/labels";

type Backup = {
  id: string;
  filename: string;
  sizeBytes: string | null;
  type: "MANUAL" | "SCHEDULED" | "PRE_RESTORE";
  status: "IN_PROGRESS" | "COMPLETED" | "FAILED";
  includesFiles: boolean;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
};

type ScheduleSettings = {
  backup_schedule_enabled: string;
  backup_schedule_frequency: string;
  backup_retention_count: string;
  backup_last_run_at: string;
};

type RestoreTarget = Backup | "upload";

type RestoreResult = {
  backupCreatedAt: string | null;
  safetyBackupId: string;
  schemaUpdates: number;
  filesRestored: boolean;
  signedIn: boolean;
  warnings: string[];
};

type Notice = {
  type: "success" | "error";
  text: string;
  /** Extra points shown under the message, e.g. restore steps that need attention. */
  details?: string[];
  /** Show a link to sign in again. */
  signIn?: boolean;
};

function formatBytes(bytes: string | null) {
  if (!bytes) return "-";
  const n = Number(bytes);
  if (!Number.isFinite(n) || n === 0) return "-";
  const units = ["B", "KB", "MB", "GB"];
  let val = n;
  let i = 0;
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024;
    i++;
  }
  return `${val.toFixed(i > 0 && val < 10 ? 1 : 0)} ${units[i]}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

const STATUS_BADGE: Record<Backup["status"], string> = {
  COMPLETED: "badge-delivered",
  FAILED: "badge-cancelled",
  IN_PROGRESS: "badge-processing",
};

const TYPE_BADGE: Record<Backup["type"], string> = {
  MANUAL: "badge-admin",
  SCHEDULED: "badge-staff",
  PRE_RESTORE: "badge-pending",
};

const TYPE_LABEL: Record<Backup["type"], string> = {
  MANUAL: "Manual",
  SCHEDULED: "Scheduled",
  PRE_RESTORE: "Before restore",
};

/** Reads an API response, also when the server answered with something other than JSON. */
async function readJson(res: Response): Promise<{ success?: boolean; data?: unknown; error?: string }> {
  try {
    return await res.json();
  } catch {
    return { success: false, error: `The server answered with an error (HTTP ${res.status}).` };
  }
}

function restoreSummary(r: RestoreResult): string {
  const parts = ["Restore completed."];
  if (r.backupCreatedAt) parts.push(`The data is now as it was on ${formatDate(r.backupCreatedAt)}.`);
  if (r.schemaUpdates > 0) parts.push("The database structure was updated to match this version of the site.");
  parts.push(
    'The data from before the restore was saved as a "Before restore" backup, so this restore can be undone from Backup History.'
  );
  if (!r.signedIn) parts.push("Your account is not in the restored data, so sign in again with an account from the backup.");
  return parts.join(" ");
}

export default function BackupSettings() {
  const [permissions, setPermissions] = useState<string[]>([]);
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<Notice | null>(null);

  const [schedule, setSchedule] = useState<ScheduleSettings>({
    backup_schedule_enabled: "false",
    backup_schedule_frequency: "daily",
    backup_retention_count: "10",
    backup_last_run_at: "",
  });
  const [savingSchedule, setSavingSchedule] = useState(false);

  const [restoreTarget, setRestoreTarget] = useState<RestoreTarget | null>(null);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoreFilesToo, setRestoreFilesToo] = useState(true);
  const [confirmText, setConfirmText] = useState("");
  const [restoring, setRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const normalizedConfirmText = confirmText.trim().toUpperCase();

  const canViewBackups = permissions.includes("admin.backups.view");
  const canCreateBackups = permissions.includes("admin.backups.create");
  const canScheduleBackups = permissions.includes("admin.backups.schedule");
  const canRestoreBackups = permissions.includes("admin.backups.restore");
  const canDeleteBackups = permissions.includes("admin.backups.delete");

  const loadAll = useCallback(async () => {
    const [meRes, backupsRes, scheduleRes] = await Promise.all([
      fetch("/api/auth/me").then((r) => r.json()),
      fetch("/api/admin/backup").then((r) => r.json()),
      fetch("/api/admin/backup/schedule").then((r) => r.json()),
    ]);
    if (meRes.success) {
      setPermissions(meRes.data.permissions || []);
    }
    if (backupsRes.success) setBackups(backupsRes.data);
    if (scheduleRes.success) setSchedule((s) => ({ ...s, ...scheduleRes.data }));
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const createBackup = async () => {
    setCreating(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/backup", { method: "POST" });
      const data = await readJson(res);
      if (data.success) {
        setMessage({ type: "success", text: "Backup created successfully." });
        await loadAll();
      } else {
        setMessage({ type: "error", text: data.error || "Backup failed." });
      }
    } catch {
      setMessage({ type: "error", text: "Backup failed. Check server logs." });
    } finally {
      setCreating(false);
    }
  };

  const removeBackup = async (id: string) => {
    if (!confirm("Delete this backup permanently? This cannot be undone.")) return;
    const res = await fetch(`/api/admin/backup/${id}`, { method: "DELETE" });
    const data = await readJson(res);
    if (data.success) setBackups((b) => b.filter((x) => x.id !== id));
    else setMessage({ type: "error", text: data.error || "Delete failed." });
  };

  const saveSchedule = async () => {
    setSavingSchedule(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/backup/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          backup_schedule_enabled: schedule.backup_schedule_enabled,
          backup_schedule_frequency: schedule.backup_schedule_frequency,
          backup_retention_count: schedule.backup_retention_count,
        }),
      });
      const data = await res.json();
      if (data.success) setMessage({ type: "success", text: "Backup schedule saved." });
      else setMessage({ type: "error", text: data.error || "Save failed." });
    } finally {
      setSavingSchedule(false);
    }
  };

  const openRestore = (target: RestoreTarget) => {
    setRestoreTarget(target);
    if (target !== "upload") {
      setRestoreFile(null);
    }
    setConfirmText("");
    setRestoreFilesToo(true);
    setRestoreError(null);
    if (target !== "upload" && fileInputRef.current) fileInputRef.current.value = "";
  };

  const closeRestore = () => {
    if (restoring) return;
    setRestoreTarget(null);
  };

  const runRestore = async () => {
    if (normalizedConfirmText !== "RESTORE" || !restoreTarget) return;
    if (restoreTarget === "upload" && !restoreFile) return;

    setRestoring(true);
    setMessage(null);
    setRestoreError(null);
    try {
      const formData = new FormData();
      formData.set("confirm", normalizedConfirmText);
      formData.set("restoreFiles", String(restoreFilesToo));
      if (restoreTarget === "upload" && restoreFile) {
        formData.set("file", restoreFile);
      } else if (restoreTarget !== "upload") {
        formData.set("backupId", restoreTarget.id);
      }

      const res = await fetch("/api/admin/backup/restore", { method: "POST", body: formData });
      const data = await readJson(res);
      if (data.success) {
        const result = data.data as RestoreResult;
        setMessage({
          type: "success",
          text: restoreSummary(result),
          details: result.warnings,
          signIn: !result.signedIn,
        });
        setRestoreTarget(null);
        setRestoreFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        if (result.signedIn) await loadAll();
      } else {
        setRestoreError(data.error || "Restore failed.");
      }
    } catch {
      setRestoreError("The server could not be reached. Check the connection, then look at Backup History before trying again.");
    } finally {
      setRestoring(false);
    }
  };

  if (loading)
    return (
      <div className="flex justify-center py-12">
        <div className="spinner" />
      </div>
    );

  if (!canViewBackups) {
    return (
      <div className="admin-card p-6 text-sm text-amber-700 bg-amber-50 flex items-center gap-2">
        <LuShieldAlert size={16} /> You do not have permission to access backup management.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {message && (
        <div
          className={`rounded-lg px-4 py-3 text-sm ${
            message.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
          }`}
        >
          <div className="flex items-start gap-2 font-medium">
            <span className="mt-0.5 flex-shrink-0">
              {message.type === "success" ? <LuCheck size={16} /> : <LuTriangleAlert size={16} />}
            </span>
            <span>{message.text}</span>
          </div>
          {message.details && message.details.length > 0 && (
            <div className="mt-3 rounded-md bg-amber-50 text-amber-800 px-3 py-2">
              <p className="font-medium">Needs attention:</p>
              <ul className="list-disc pl-5 mt-1 space-y-1">
                {message.details.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </div>
          )}
          {message.signIn && (
            <a href="/signin" className="admin-btn admin-btn-secondary inline-flex mt-3">
              Sign in again
            </a>
          )}
        </div>
      )}

      {/* Create backup now */}
      <div className="admin-card p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
              <LuDatabaseBackup className="text-indigo-600" size={22} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-800">Full Backup</h3>
              <p className="text-sm text-slate-500 mt-0.5 max-w-xl">
                Creates one downloadable archive with the entire database (all orders,
                products, users, settings) and every uploaded file (product images).
              </p>
            </div>
          </div>
          <button
            onClick={createBackup}
            disabled={creating || !canCreateBackups}
            className="admin-btn admin-btn-primary inline-flex items-center gap-2 whitespace-nowrap"
          >
            <LuDatabaseBackup size={16} />
            {creating ? "Creating backup…" : "Create Backup Now"}
          </button>
        </div>
      </div>

      {/* Automatic schedule */}
      <div className="admin-card p-6">
        <h3 className="text-base font-semibold text-slate-800 mb-4">Automatic Backups</h3>
        <div className="grid sm:grid-cols-3 gap-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Status</label>
            <label className="flex items-center gap-2 cursor-pointer">
              <div
                className={`w-11 h-6 rounded-full cursor-pointer ${
                  schedule.backup_schedule_enabled === "true" ? "bg-indigo-600" : "bg-slate-200"
                }`}
                onClick={() =>
                  setSchedule((s) => ({
                    ...s,
                    backup_schedule_enabled: s.backup_schedule_enabled === "true" ? "false" : "true",
                  }))
                }
              >
                <div
                  className={`w-5 h-5 bg-white rounded-full shadow mt-0.5 ${
                    schedule.backup_schedule_enabled === "true" ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </div>
              <span className="text-sm text-slate-600">
                {schedule.backup_schedule_enabled === "true" ? "Enabled" : "Disabled"}
              </span>
            </label>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Frequency</label>
            <select
              className="admin-input"
              value={schedule.backup_schedule_frequency}
              onChange={(e) => setSchedule((s) => ({ ...s, backup_schedule_frequency: e.target.value }))}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Keep Last N Backups
            </label>
            <input
              type="number"
              min={1}
              className="admin-input"
              value={schedule.backup_retention_count}
              onChange={(e) => setSchedule((s) => ({ ...s, backup_retention_count: e.target.value }))}
            />
          </div>
        </div>
        {schedule.backup_last_run_at && (
          <p className="text-xs text-slate-500 mt-3">
            Last automatic backup: {formatDate(schedule.backup_last_run_at)}
          </p>
        )}
        <div className="mt-4">
          <button
            onClick={saveSchedule}
            disabled={savingSchedule || !canScheduleBackups}
            className="admin-btn admin-btn-secondary"
          >
            {savingSchedule ? "Saving…" : "Save Schedule"}
          </button>
        </div>
      </div>

      {/* Restore from an uploaded file */}
      <div className="admin-card p-6">
        <h3 className="text-base font-semibold text-slate-800 mb-2">Restore From File</h3>
        <p className="text-sm text-slate-500 mb-4 max-w-xl">
          Upload a <code className="px-1 py-0.5 bg-slate-100 rounded">.tar.gz</code> backup archive
          (created by this same feature, on this or another server) to restore it.
        </p>
        {canRestoreBackups ? (
          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".gz,.tgz,.tar,application/gzip,application/x-gzip,application/x-tar"
              onChange={(e) => setRestoreFile(e.target.files?.[0] ?? null)}
              className="text-sm text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-slate-100 file:text-slate-700 file:text-sm hover:file:bg-slate-200"
            />
            <button
              onClick={() => openRestore("upload")}
              disabled={!restoreFile || !canRestoreBackups}
              className="admin-btn admin-btn-secondary inline-flex items-center gap-2"
            >
              <LuUpload size={16} /> Restore This File
            </button>
          </div>
        ) : (
          <p className="text-sm text-amber-600 flex items-center gap-2">
            <LuShieldAlert size={16} /> You do not have permission to restore backups.
          </p>
        )}
      </div>

      {/* History */}
      <div className="admin-card p-6">
        <h3 className="text-base font-semibold text-slate-800 mb-4">Backup History</h3>
        {backups.length === 0 ? (
          <p className="text-sm text-slate-500">No backups yet. Create your first one above.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="py-2 pr-4 font-medium">Created</th>
                  <th className="py-2 pr-4 font-medium">Type</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 font-medium">Size</th>
                  <th className="py-2 pr-4 font-medium">Files Included</th>
                  <th className="py-2 pr-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {backups.map((b) => (
                  <tr key={b.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-3 pr-4 text-slate-700">{formatDate(b.createdAt)}</td>
                    <td className="py-3 pr-4">
                      <span className={`badge ${TYPE_BADGE[b.type] ?? "badge-admin"}`}>
                        {TYPE_LABEL[b.type] ?? humanize(b.type)}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`badge ${STATUS_BADGE[b.status]}`}>{humanize(b.status)}</span>
                      {b.status === "FAILED" && b.errorMessage && (
                        <span className="block text-xs text-red-500 mt-1 max-w-xs truncate" title={b.errorMessage}>
                          {b.errorMessage}
                        </span>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-slate-700">{formatBytes(b.sizeBytes)}</td>
                    <td className="py-3 pr-4 text-slate-700">{b.includesFiles ? "Yes" : "No"}</td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center justify-end gap-1.5">
                        {b.status === "COMPLETED" && (
                          <a
                            href={`/api/admin/backup/${b.id}/download`}
                            className="p-2 rounded text-slate-500 hover:bg-slate-100"
                            title="Download"
                          >
                            <LuDownload size={16} />
                          </a>
                        )}
                        {canRestoreBackups && b.status === "COMPLETED" && (
                          <button
                            onClick={() => openRestore(b)}
                            className="p-2 rounded text-indigo-600 hover:bg-indigo-50"
                            title="Restore this backup"
                          >
                            <LuRotateCcw size={16} />
                          </button>
                        )}
                        {canDeleteBackups && (
                          <button
                            onClick={() => removeBackup(b.id)}
                            className="p-2 rounded text-red-500 hover:bg-red-50"
                            title="Delete"
                          >
                            <LuTrash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Restore confirmation modal */}
      <AdminModal
        open={restoreTarget !== null}
        onClose={closeRestore}
        title={
          <span className="flex items-center gap-2 text-red-600">
            <LuTriangleAlert size={18} /> Confirm Restore
          </span>
        }
        footer={
          <>
            <button onClick={closeRestore} className="admin-btn admin-btn-secondary" disabled={restoring}>
              Cancel
            </button>
            <button
              onClick={runRestore}
              disabled={normalizedConfirmText !== "RESTORE" || restoring || (restoreTarget === "upload" && !restoreFile)}
              className="admin-btn bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
            >
              <LuHardDriveDownload size={16} className="inline mr-1.5 -mt-0.5" />
              {restoring ? "Restoring…" : "Restore Now"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <span className="text-slate-500">Restoring: </span>
            {restoreTarget === "upload" || restoreTarget === null ? (
              <span className="font-medium break-all">{restoreFile?.name ?? "-"}</span>
            ) : (
              <span className="font-medium">
                {formatDate(restoreTarget.createdAt)} ({TYPE_LABEL[restoreTarget.type] ?? humanize(restoreTarget.type)})
              </span>
            )}
          </div>

          <p className="text-sm text-slate-700">
            This will <strong>completely replace</strong> the current database
            {restoreTarget !== "upload" ? " with the selected backup" : " with the uploaded file"}.
            Changes made after this backup was created will no longer be in the site.
          </p>

          <ul className="text-sm text-slate-600 list-disc pl-5 space-y-1">
            <li>The backup is checked and test-loaded first. If it has a problem, nothing is changed.</li>
            <li>
              The current data is saved automatically as a &quot;Before restore&quot; backup, so you can
              undo the restore from Backup History.
            </li>
            <li>The restore is done in one step: either all of it is applied, or nothing is.</li>
          </ul>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={restoreFilesToo}
              onChange={(e) => setRestoreFilesToo(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300"
            />
            Also restore uploaded product files (replaces current files)
          </label>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Type <span className="font-mono bg-slate-100 px-1 rounded">RESTORE</span> to confirm
            </label>
            <input
              className="admin-input"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="RESTORE"
              autoComplete="off"
              disabled={restoring}
            />
          </div>

          {restoring && (
            <p className="text-sm text-slate-600">
              Restoring. This can take a minute or two. Keep this page open.
            </p>
          )}

          {restoreError && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 flex items-start gap-2">
              <LuTriangleAlert size={16} className="mt-0.5 flex-shrink-0" />
              <span>{restoreError}</span>
            </div>
          )}
        </div>
      </AdminModal>
    </div>
  );
}
