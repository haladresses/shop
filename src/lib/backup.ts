import { spawn, spawnSync } from "child_process";
import fs from "fs";
import { promises as fsp } from "fs";
import os from "os";
import path from "path";
import { randomUUID } from "crypto";
import { BackupStatus, BackupType } from "@prisma/client";
import prisma from "@/lib/db";

export const BACKUP_DIR = path.join(process.cwd(), "backups");
export const UPLOADS_DIR = path.join(process.cwd(), "public", "images", "products");
export const DEFAULT_RETENTION = 10;

function commandExists(cmd: string): boolean {
  const lookup = process.platform === "win32" ? "where.exe" : "which";
  const result = spawnSync(lookup, [cmd], { stdio: "ignore" });
  return result.status === 0;
}

function resolveDatabaseCommand(tool: "pg_dump" | "psql") {
  const envPath = tool === "pg_dump" ? process.env.PG_DUMP_PATH : process.env.PSQL_PATH;
  if (envPath && envPath.trim()) {
    return { cmd: envPath, args: [] as string[], usesDockerCompose: false, service: "" };
  }

  if (commandExists(tool)) {
    return { cmd: tool, args: [] as string[], usesDockerCompose: false, service: "" };
  }

  const docker = process.env.DOCKER_BIN || "docker";
  const service = process.env.POSTGRES_SERVICE_NAME || "postgres";
  if (commandExists(docker)) {
    return { cmd: docker, args: ["compose", "exec", "-T", service, tool], usesDockerCompose: true, service };
  }

  throw new Error(
    `Required database client "${tool}" is not installed locally and Docker Compose is not available for fallback.`
  );
}

async function ensureComposeServiceRunning(cmd: string, service: string): Promise<void> {
  // Start the DB service on demand so docker-compose fallback works even after host/app restarts.
  await run(cmd, ["compose", "up", "-d", service]);
}

function rewriteConnectionUrlForComposeExec(raw: string): string {
  try {
    const url = new URL(raw);
    const isPostgresScheme = url.protocol === "postgresql:" || url.protocol === "postgres:";
    if (!isPostgresScheme) return raw;

    const loopbackHosts = new Set(["localhost", "127.0.0.1", "::1"]);
    if (loopbackHosts.has(url.hostname)) {
      // Commands run via `docker compose exec postgres ...` execute inside the DB container,
      // where PostgreSQL listens on its internal port 5432.
      url.hostname = "127.0.0.1";
      url.port = "5432";
    }

    return url.toString();
  } catch {
    return raw;
  }
}

function run(
  cmd: string,
  args: string[],
  options: { stdinPath?: string; stdoutPath?: string } = {}
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { env: process.env, cwd: process.cwd(), stdio: ["pipe", "pipe", "pipe"] });
    let stderr = "";
    let settled = false;

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      fn();
    };

    const fail = (message: string) => {
      finish(() => reject(new Error(message)));
    };

    if (options.stdinPath) {
      const input = fs.createReadStream(options.stdinPath);
      input.on("error", (err) => fail(`Failed to read input file for "${cmd}": ${err.message}`));
      input.pipe(child.stdin!);
    } else {
      child.stdin?.end();
    }

    if (options.stdoutPath) {
      const output = fs.createWriteStream(options.stdoutPath);
      output.on("error", (err) => fail(`Failed to write output file for "${cmd}": ${err.message}`));
      child.stdout?.on("data", (chunk) => output.write(chunk));
      child.stdout?.on("end", () => output.end());
    } else {
      child.stdout?.on("data", () => {});
    }

    child.stderr?.on("data", (d) => {
      stderr += d.toString();
    });

    child.on("error", (err) => {
      fail(`Failed to launch "${cmd}": ${err.message}`);
    });

    child.on("close", (code) => {
      if (code === 0) {
        finish(() => resolve());
      } else {
        fail(`"${cmd}" exited with code ${code}: ${stderr.slice(-4000)}`);
      }
    });
  });
}

async function runDatabaseTool(
  tool: "pg_dump" | "psql",
  args: string[],
  options: { stdinPath?: string; stdoutPath?: string } = {}
): Promise<void> {
  const resolved = resolveDatabaseCommand(tool);
  const effectiveArgs = [...args];
  if (resolved.usesDockerCompose && effectiveArgs.length > 0) {
    effectiveArgs[0] = rewriteConnectionUrlForComposeExec(effectiveArgs[0]);
  }

  try {
    await run(resolved.cmd, [...resolved.args, ...effectiveArgs], options);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const serviceNotRunning =
      message.includes("service \"") && message.includes("\" is not running");

    if (resolved.usesDockerCompose && serviceNotRunning) {
      try {
        await ensureComposeServiceRunning(resolved.cmd, resolved.service);
      } catch (startError) {
        const startMessage = startError instanceof Error ? startError.message : String(startError);
        throw new Error(
          `Docker Compose service "${resolved.service}" is not running and could not be started automatically. ${startMessage}`
        );
      }

      await run(resolved.cmd, [...resolved.args, ...effectiveArgs], options);
      return;
    }

    throw e;
  }
}

/**
 * Prisma's DATABASE_URL carries query params (`schema`, `connection_limit`, ...)
 * that libpq-based tools (pg_dump/psql) reject with "invalid URI query parameter".
 * Strip the Prisma-only ones and surface the target schema separately.
 */
function parseConnectionUrl(rawUrl: string): { cleanUrl: string; schema: string } {
  const url = new URL(rawUrl);
  const schema = url.searchParams.get("schema") || "public";
  url.searchParams.delete("schema");
  url.searchParams.delete("connection_limit");
  url.searchParams.delete("pgbouncer");
  return { cleanUrl: url.toString(), schema };
}

function requireConnection(): { cleanUrl: string; schema: string } {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL is not configured");
  return parseConnectionUrl(raw);
}

export type BackupRecord = Awaited<ReturnType<typeof prisma.backup.create>>;

export async function createBackup(opts: {
  type: BackupType;
  userId?: string;
  retention?: number;
}): Promise<BackupRecord> {
  const { cleanUrl, schema } = requireConnection();
  await fsp.mkdir(BACKUP_DIR, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `backup-${timestamp}-${randomUUID().slice(0, 8)}.tar.gz`;
  const finalPath = path.join(BACKUP_DIR, filename);
  const workDir = path.join(os.tmpdir(), `hala-backup-${randomUUID()}`);

  const record = await prisma.backup.create({
    data: {
      filename,
      type: opts.type,
      status: BackupStatus.IN_PROGRESS,
      createdById: opts.userId,
    },
  });

  try {
    await fsp.mkdir(workDir, { recursive: true });

    // 1. Dump the full database schema + data as portable, idempotent SQL.
    await runDatabaseTool(
      "pg_dump",
      [
        cleanUrl,
        "--no-owner",
        "--no-privileges",
        "--clean",
        "--if-exists",
        "--schema",
        schema,
      ],
      { stdoutPath: path.join(workDir, "database.sql") }
    );

    // 2. Copy uploaded product/media files (the only writable, non-git directory).
    let includesFiles = false;
    if (fs.existsSync(UPLOADS_DIR)) {
      await fsp.cp(UPLOADS_DIR, path.join(workDir, "uploads"), { recursive: true });
      includesFiles = true;
    }

    await fsp.writeFile(
      path.join(workDir, "manifest.json"),
      JSON.stringify(
        { createdAt: new Date().toISOString(), type: opts.type, includesFiles },
        null,
        2
      )
    );

    // 3. Archive everything into a single, portable tar.gz.
    await run("tar", ["-czf", finalPath, "-C", workDir, "."]);

    const stat = await fsp.stat(finalPath);

    const updated = await prisma.backup.update({
      where: { id: record.id },
      data: {
        status: BackupStatus.COMPLETED,
        sizeBytes: BigInt(stat.size),
        includesFiles,
        completedAt: new Date(),
      },
    });

    await enforceRetention(opts.retention ?? DEFAULT_RETENTION);

    return updated;
  } catch (e) {
    await fsp.rm(finalPath, { force: true }).catch(() => {});
    await prisma.backup
      .update({
        where: { id: record.id },
        data: {
          status: BackupStatus.FAILED,
          errorMessage: e instanceof Error ? e.message.slice(0, 1000) : "Unknown error",
        },
      })
      .catch(() => {});
    throw e;
  } finally {
    await fsp.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function enforceRetention(retention: number) {
  if (!retention || retention <= 0) return;
  const backups = await prisma.backup.findMany({
    where: { status: BackupStatus.COMPLETED },
    orderBy: { createdAt: "desc" },
  });
  const toDelete = backups.slice(retention);
  for (const b of toDelete) {
    await deleteBackup(b.id).catch(() => {});
  }
}

export async function deleteBackup(id: string): Promise<void> {
  const backup = await prisma.backup.findUnique({ where: { id } });
  if (!backup) return;
  await fsp.rm(path.join(BACKUP_DIR, backup.filename), { force: true }).catch(() => {});
  await prisma.backup.delete({ where: { id } });
}

export async function restoreBackup(
  sourcePath: string,
  opts: { restoreFiles?: boolean } = {}
): Promise<void> {
  const { cleanUrl } = requireConnection();
  const workDir = path.join(os.tmpdir(), `hala-restore-${randomUUID()}`);
  await fsp.mkdir(workDir, { recursive: true });

  try {
    await run("tar", ["-xzf", sourcePath, "-C", workDir]);

    const sqlPath = path.join(workDir, "database.sql");
    if (!fs.existsSync(sqlPath)) {
      throw new Error("Invalid backup archive: database.sql not found");
    }

    // --clean --if-exists in the dump makes this safe to re-run: it drops
    // and recreates every object before loading data.
    await runDatabaseTool("psql", [cleanUrl, "-v", "ON_ERROR_STOP=1"], { stdinPath: sqlPath });

    const uploadsSrc = path.join(workDir, "uploads");
    if (opts.restoreFiles !== false && fs.existsSync(uploadsSrc)) {
      await fsp.rm(UPLOADS_DIR, { recursive: true, force: true }).catch(() => {});
      await fsp.mkdir(UPLOADS_DIR, { recursive: true });
      await fsp.cp(uploadsSrc, UPLOADS_DIR, { recursive: true });
    }
  } finally {
    await fsp.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

export function serializeBackup(b: BackupRecord) {
  return {
    id: b.id,
    filename: b.filename,
    sizeBytes: b.sizeBytes !== null ? b.sizeBytes.toString() : null,
    type: b.type,
    status: b.status,
    includesFiles: b.includesFiles,
    errorMessage: b.errorMessage,
    createdById: b.createdById,
    createdAt: b.createdAt,
    completedAt: b.completedAt,
  };
}
