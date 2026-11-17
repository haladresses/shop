-- Safety backups taken automatically right before a restore.
ALTER TYPE "BackupType" ADD VALUE IF NOT EXISTS 'PRE_RESTORE';
