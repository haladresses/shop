import { BackupType } from "@prisma/client";
import prisma from "@/lib/db";
import { createBackup } from "@/lib/backup";

const CHECK_INTERVAL_MS = 30 * 60 * 1000; // re-check every 30 minutes
const FIRST_CHECK_DELAY_MS = 60 * 1000; // let the app finish booting first

let started = false;

async function getSetting(key: string): Promise<string | null> {
  const row = await prisma.setting.findUnique({ where: { key } });
  return row?.value ?? null;
}

async function setSetting(key: string, value: string) {
  await prisma.setting.upsert({
    where: { key },
    update: { value, group: "backup" },
    create: { key, value, group: "backup" },
  });
}

async function tick() {
  try {
    const enabled = (await getSetting("backup_schedule_enabled")) === "true";
    if (!enabled) return;

    const frequency = (await getSetting("backup_schedule_frequency")) || "daily";
    const intervalMs = frequency === "weekly" ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;

    const lastRunStr = await getSetting("backup_last_run_at");
    const lastRun = lastRunStr ? new Date(lastRunStr) : null;
    if (lastRun && Date.now() - lastRun.getTime() < intervalMs) return;

    const retentionStr = await getSetting("backup_retention_count");
    const retention = retentionStr ? parseInt(retentionStr, 10) : undefined;

    await createBackup({ type: BackupType.SCHEDULED, retention });
    await setSetting("backup_last_run_at", new Date().toISOString());
  } catch (e) {
    console.error("[backup-scheduler] scheduled backup failed:", e);
  }
}

/** Starts the in-process automatic backup scheduler. Safe to call multiple times. */
export function startBackupScheduler() {
  if (started) return;
  started = true;
  setTimeout(tick, FIRST_CHECK_DELAY_MS);
  setInterval(tick, CHECK_INTERVAL_MS);
}
