import { spawn, spawnSync } from "child_process";
import fs from "fs";
import { promises as fsp } from "fs";
import os from "os";
import path from "path";
import { randomUUID } from "crypto";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import { BackupStatus, BackupType, type Backup, type Session, type Setting } from "@prisma/client";
import prisma from "@/lib/db";

export const BACKUP_DIR = path.join(process.cwd(), "backups");
export const UPLOADS_DIR = path.join(process.cwd(), "public", "images", "products");
export const BUNDLED_PRODUCT_IMAGES_DIR = path.join(process.cwd(), "seed-assets", "products");
const PRISMA_SCHEMA_PATH = path.join(process.cwd(), "prisma", "schema.prisma");
export const DEFAULT_RETENTION = 10;

/** Version of the archive layout recorded in manifest.json. */
const ARCHIVE_FORMAT = 2;
const DUMP_HEADER = "PostgreSQL database dump";
/** pg_dump writes this line last, so a dump without it was cut short. */
const DUMP_TRAILER = "PostgreSQL database dump complete";
/** Settings that describe this server's backup routine, not the shop's data. */
const BACKUP_SETTING_KEYS = [
  "backup_schedule_enabled",
  "backup_schedule_frequency",
  "backup_retention_count",
  "backup_last_run_at",
];
/** Same rule as docker-init.sh: schema changes that drop or rewrite data are never applied. */
const DESTRUCTIVE_SQL =
  /\bDROP\s+(TABLE|COLUMN|TYPE|SCHEMA)\b|\bTRUNCATE\b|\bDELETE\s+FROM\b|\bSET\s+DATA\s+TYPE\b/i;
/** Temporary databases used to test-load a backup are named "<db>_restore_check_<id>". */
const SCRATCH_DB_MARKER = "_restore_check_";
/** A backup still "in progress" after this long was cut off by a server restart. */
const INTERRUPTED_AFTER_MS = 2 * 60 * 60 * 1000;

// ─────────────────────────────────────────────
// Errors
// ─────────────────────────────────────────────

/** A failure explained in words meant for the admin. API routes show the message as is. */
export class BackupError extends Error {
  constructor(
    message: string,
    readonly status = 400
  ) {
    super(message);
    this.name = "BackupError";
  }
}

/** A database or archive tool that exited with an error. */
class ToolError extends Error {
  constructor(
    readonly tool: string,
    readonly stderr: string,
    exitCode: number | null
  ) {
    super(`${tool} exited with code ${exitCode}: ${summarizeToolOutput(stderr)}`);
    this.name = "ToolError";
  }
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function redactSecrets(text: string): string {
  return text.replace(/(\b[a-z][a-z0-9+.-]*:\/\/[^\s:@/]+:)[^\s@]+@/gi, "$1****@");
}

/** The lines of a tool's error output that explain the failure, e.g. psql's ERROR + DETAIL. */
function summarizeToolOutput(stderr: string): string {
  const lines = stderr
    .split(/\r?\n/)
    .map((line) => line.replace(/^psql:[^:]*:\d+:\s*/, "").replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const first = lines.findIndex((line) => /\b(ERROR|FATAL|PANIC):/.test(line));
  let picked = lines.slice(-3);
  if (first >= 0) {
    picked = [lines[first]];
    for (const line of lines.slice(first + 1)) {
      if (!/^(DETAIL|HINT):/.test(line)) break;
      picked.push(line);
    }
  }
  return redactSecrets(picked.join(" ")).slice(0, 700) || "no error output";
}

/** A short explanation of any error from this module, without passwords, fit to show an admin. */
export function describeBackupError(e: unknown): string {
  if (e instanceof BackupError) return e.message;
  if (e instanceof ToolError) return summarizeToolOutput(e.stderr);
  return redactSecrets(errorMessage(e)).slice(0, 700);
}

// ─────────────────────────────────────────────
// One job at a time
// ─────────────────────────────────────────────

type Job = "backup" | "restore";
const jobState = globalThis as unknown as { __halaBackupJob?: Job | null };

/** Backups and restores never overlap: a backup taken mid-restore would capture half-replaced data. */
async function exclusively<T>(job: Job, fn: () => Promise<T>): Promise<T> {
  const running = jobState.__halaBackupJob;
  if (running) {
    throw new BackupError(
      running === "restore"
        ? "A restore is running right now. Try again when it has finished."
        : "A backup is being created right now. Try again when it has finished.",
      409
    );
  }
  jobState.__halaBackupJob = job;
  try {
    return await fn();
  } finally {
    jobState.__halaBackupJob = null;
  }
}

// ─────────────────────────────────────────────
// Running external tools
// ─────────────────────────────────────────────

type RunOptions = {
  /** Creates the stream fed to stdin (a factory, so a retry can feed it again). */
  input?: () => Readable;
  /** Write stdout to this file instead of returning it. */
  outputPath?: string;
  /** Throw stdout away (psql prints rows while it loads a dump). */
  discardOutput?: boolean;
  env?: Record<string, string>;
  /** Name used in error messages. */
  label?: string;
};

/** Runs a command and resolves with its stdout once it exited cleanly and all output is on disk. */
async function run(cmd: string, args: string[], opts: RunOptions = {}): Promise<string> {
  const label = opts.label ?? cmd;
  const child = spawn(cmd, args, {
    env: { ...process.env, ...opts.env },
    cwd: process.cwd(),
    stdio: ["pipe", "pipe", "pipe"],
  });

  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk: string) => {
    stderr = (stderr + chunk).slice(-20_000);
  });

  // A tool that stops early (psql halts on the first error) makes writes to its
  // stdin fail with EPIPE. Its exit code reports the real problem.
  child.stdin.on("error", () => {});
  let inputDone: Promise<unknown> = Promise.resolve(null);
  if (opts.input) {
    inputDone = pipeline(opts.input(), child.stdin).then(
      () => null,
      (e: unknown) => e
    );
  } else {
    child.stdin.end();
  }

  let stdout = "";
  let outputDone: Promise<unknown>;
  if (opts.outputPath) {
    outputDone = pipeline(child.stdout, fs.createWriteStream(opts.outputPath)).then(
      () => null,
      (e: unknown) => e
    );
  } else {
    outputDone = new Promise((resolve) => {
      if (opts.discardOutput) {
        child.stdout.resume();
      } else {
        child.stdout.setEncoding("utf8");
        child.stdout.on("data", (chunk: string) => {
          stdout += chunk;
        });
      }
      child.stdout.once("close", () => resolve(null));
    });
  }

  const exitCode = await new Promise<number | null>((resolve, reject) => {
    child.once("error", reject);
    child.once("close", resolve);
  }).catch((e: unknown) => {
    throw new Error(`Could not start ${label}: ${errorMessage(e)}`);
  });

  const [inputError, outputError] = await Promise.all([inputDone, outputDone]);
  if (exitCode !== 0) throw new ToolError(label, stderr, exitCode);
  if (inputError) throw new Error(`Could not feed data to ${label}: ${errorMessage(inputError)}`);
  if (outputError) throw new Error(`Could not save the output of ${label}: ${errorMessage(outputError)}`);
  return stdout;
}

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

  throw new BackupError(
    `The database tool "${tool}" is not installed on the server, and Docker Compose is not available to run it instead.`,
    500
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

/** Runs pg_dump/psql; the first argument must be the connection URL. */
async function runDatabaseTool(
  tool: "pg_dump" | "psql",
  args: string[],
  options: RunOptions = {}
): Promise<string> {
  const resolved = resolveDatabaseCommand(tool);
  const effectiveArgs = [...args];
  if (resolved.usesDockerCompose && effectiveArgs.length > 0) {
    effectiveArgs[0] = rewriteConnectionUrlForComposeExec(effectiveArgs[0]);
  }
  const runOptions = { ...options, label: tool };

  try {
    return await run(resolved.cmd, [...resolved.args, ...effectiveArgs], runOptions);
  } catch (e) {
    const serviceNotRunning =
      e instanceof ToolError && e.stderr.includes('service "') && e.stderr.includes('" is not running');
    if (!resolved.usesDockerCompose || !serviceNotRunning) throw e;

    try {
      await ensureComposeServiceRunning(resolved.cmd, resolved.service);
    } catch (startError) {
      throw new BackupError(
        `The database service "${resolved.service}" is not running and could not be started automatically. ${describeBackupError(startError)}`,
        500
      );
    }
    return run(resolved.cmd, [...resolved.args, ...effectiveArgs], runOptions);
  }
}

// ─────────────────────────────────────────────
// Database connection and SQL
// ─────────────────────────────────────────────

type DbTarget = {
  /** Prisma-style URL (keeps ?schema=...), for the Prisma CLI. */
  prismaUrl: string;
  /** The same URL without Prisma-only parameters, which pg_dump/psql reject. */
  pgUrl: string;
  database: string;
  schema: string;
};

const PRISMA_ONLY_URL_PARAMS = [
  "schema",
  "connection_limit",
  "pool_timeout",
  "socket_timeout",
  "pgbouncer",
  "statement_cache_size",
  "sslaccept",
  "sslidentity",
];

function describeTarget(prismaUrl: string): DbTarget {
  const url = new URL(prismaUrl);
  const schema = url.searchParams.get("schema") || "public";
  for (const param of PRISMA_ONLY_URL_PARAMS) url.searchParams.delete(param);
  return {
    prismaUrl,
    pgUrl: url.toString(),
    database: decodeURIComponent(url.pathname.replace(/^\//, "")),
    schema,
  };
}

function currentTarget(): DbTarget {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new BackupError("DATABASE_URL is not configured on the server.", 500);
  return describeTarget(raw);
}

/** The same server and credentials, another database. */
function withDatabase(target: DbTarget, database: string): DbTarget {
  const url = new URL(target.prismaUrl);
  url.pathname = `/${encodeURIComponent(database)}`;
  return describeTarget(url.toString());
}

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

function unquoteIdent(name: string): string {
  return name.startsWith('"') ? name.slice(1, -1).replace(/""/g, '"') : name;
}

async function psqlQuery(target: DbTarget, sql: string): Promise<string> {
  return runDatabaseTool("psql", [
    target.pgUrl,
    "--no-psqlrc",
    "--quiet",
    "--tuples-only",
    "--no-align",
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    sql,
  ]);
}

type SqlPart = string | { file: string };

function sqlStream(parts: SqlPart[]): Readable {
  return Readable.from(
    (async function* () {
      for (const part of parts) {
        if (typeof part === "string") {
          yield Buffer.from(`${part}\n`);
        } else {
          yield* fs.createReadStream(part.file);
          yield Buffer.from("\n");
        }
      }
    })()
  );
}

/**
 * Runs SQL as one transaction. COMMIT is the very last thing sent, so when psql
 * stops on an error (ON_ERROR_STOP) or the input is cut short, nothing is
 * committed and PostgreSQL rolls the whole transaction back.
 */
async function runInTransaction(target: DbTarget, parts: SqlPart[]): Promise<void> {
  await runDatabaseTool("psql", [target.pgUrl, "--no-psqlrc", "--quiet", "-v", "ON_ERROR_STOP=1"], {
    input: () => sqlStream(["BEGIN;", ...parts, "COMMIT;"]),
    discardOutput: true,
  });
}

/**
 * Empties the schema completely before a dump is loaded. The dump's own
 * "DROP ... IF EXISTS" lines only know the objects that existed when it was
 * made, so tables added since then would block them.
 */
function schemaResetSql(schema: string): string {
  const name = quoteIdent(schema);
  return [
    // Give up instead of waiting forever behind a long-running query.
    "SET LOCAL lock_timeout = '30s';",
    `DROP SCHEMA IF EXISTS ${name} CASCADE;`,
    `CREATE SCHEMA ${name};`,
  ].join("\n");
}

async function dropDatabase(server: DbTarget, name: string): Promise<void> {
  await psqlQuery(server, `DROP DATABASE IF EXISTS ${quoteIdent(name)} WITH (FORCE)`);
}

/**
 * Creates an empty temporary database on the same server, or returns null when
 * the database user is not allowed to create databases.
 */
async function createScratchDatabase(target: DbTarget): Promise<DbTarget | null> {
  const prefix = `${target.database.toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 30)}${SCRATCH_DB_MARKER}`;

  // Remove leftovers of a test-load that a server restart interrupted.
  const leftovers = await psqlQuery(
    target,
    `SELECT datname FROM pg_database WHERE strpos(datname, '${prefix}') = 1`
  ).catch(() => "");
  for (const name of leftovers.split("\n").map((line) => line.trim()).filter(Boolean)) {
    await dropDatabase(target, name).catch(() => {});
  }

  const name = `${prefix}${randomUUID().replace(/-/g, "").slice(0, 8)}`;
  try {
    await psqlQuery(target, `CREATE DATABASE ${quoteIdent(name)}`);
  } catch (e) {
    if (e instanceof ToolError && /permission denied/i.test(e.stderr)) return null;
    throw e;
  }
  return withDatabase(target, name);
}

// ─────────────────────────────────────────────
// Schema upgrade (backup made by an older version of the site)
// ─────────────────────────────────────────────

function prismaCli(): { cmd: string; args: string[] } {
  const local = path.join(process.cwd(), "node_modules", "prisma", "build", "index.js");
  if (fs.existsSync(local)) return { cmd: process.execPath, args: [local] };
  return { cmd: process.platform === "win32" ? "npx.cmd" : "npx", args: ["--no-install", "prisma"] };
}

function sqlStatementCount(sql: string): number {
  return sql
    .replace(/--[^\n]*/g, "")
    .split(";")
    .filter((statement) => statement.trim()).length;
}

function destructiveStatements(sql: string): string[] {
  return sql
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => DESTRUCTIVE_SQL.test(line));
}

/**
 * SQL that brings a database up to this version's prisma/schema.prisma, or ""
 * when it already matches. The restore counterpart of the additive
 * `prisma db push` that docker-init.sh runs on every deploy.
 */
async function schemaUpgradeSql(target: DbTarget): Promise<string> {
  const { cmd, args } = prismaCli();
  const sql = await run(
    cmd,
    [
      ...args,
      "migrate",
      "diff",
      "--from-schema-datasource",
      PRISMA_SCHEMA_PATH,
      "--to-schema-datamodel",
      PRISMA_SCHEMA_PATH,
      "--script",
    ],
    {
      label: "prisma migrate diff",
      // The datasource URL is read from the environment, which keeps the
      // password off the command line.
      env: { DATABASE_URL: target.prismaUrl, PRISMA_HIDE_UPDATE_MESSAGE: "1", CHECKPOINT_DISABLE: "1" },
    }
  );
  return sqlStatementCount(sql) > 0 ? sql : "";
}

// ─────────────────────────────────────────────
// Archives and files
// ─────────────────────────────────────────────

type BackupManifest = {
  format?: number;
  createdAt?: string;
  type?: string;
  includesFiles?: boolean;
  appVersion?: string;
  schema?: string;
  databaseVersion?: string;
};

type DumpInfo = { schema: string | null; serverVersion: string | null };

type UnpackedBackup = {
  sqlPath: string;
  imagesDir: string | null;
  manifest: BackupManifest | null;
  dump: DumpInfo;
};

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fsp.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function mergeDirectoryInto(sourceDir: string, targetDir: string): Promise<boolean> {
  if (!(await pathExists(sourceDir))) return false;

  await fsp.mkdir(targetDir, { recursive: true });
  await fsp.cp(sourceDir, targetDir, { recursive: true, force: true });
  return true;
}

async function buildProductImagesSnapshot(targetDir: string): Promise<boolean> {
  const bundledCopied = await mergeDirectoryInto(BUNDLED_PRODUCT_IMAGES_DIR, targetDir);
  const uploadsCopied = await mergeDirectoryInto(UPLOADS_DIR, targetDir);
  return bundledCopied || uploadsCopied;
}

async function restoreBundledProductImages(): Promise<void> {
  await mergeDirectoryInto(BUNDLED_PRODUCT_IMAGES_DIR, UPLOADS_DIR);
}

/**
 * Puts the archive's product images in place. Only the folder's contents are
 * swapped, never the folder itself: in Docker it is a mounted volume.
 */
async function restoreProductImages(archiveImagesDir: string | null): Promise<boolean> {
  if (!archiveImagesDir) {
    await restoreBundledProductImages();
    return false;
  }
  // Images that ship with the site fill gaps but never replace the archive's copies.
  if (await pathExists(BUNDLED_PRODUCT_IMAGES_DIR)) {
    await fsp.cp(BUNDLED_PRODUCT_IMAGES_DIR, archiveImagesDir, {
      recursive: true,
      force: false,
      errorOnExist: false,
    });
  }
  await fsp.mkdir(UPLOADS_DIR, { recursive: true });
  for (const entry of await fsp.readdir(UPLOADS_DIR)) {
    await fsp.rm(path.join(UPLOADS_DIR, entry), { recursive: true, force: true });
  }
  await fsp.cp(archiveImagesDir, UPLOADS_DIR, { recursive: true, force: true });
  return true;
}

async function readSlice(filePath: string, start: number, length: number): Promise<string> {
  const handle = await fsp.open(filePath, "r");
  try {
    const buffer = Buffer.alloc(length);
    const { bytesRead } = await handle.read(buffer, 0, length, start);
    return buffer.toString("utf8", 0, bytesRead);
  } finally {
    await handle.close();
  }
}

/** Checks that a pg_dump file is complete and reads which schema and server version it came from. */
async function inspectDump(sqlPath: string): Promise<DumpInfo> {
  const { size } = await fsp.stat(sqlPath);
  const head = await readSlice(sqlPath, 0, Math.min(size, 256 * 1024));
  const tail = await readSlice(sqlPath, Math.max(0, size - 4096), Math.min(size, 4096));

  if (!head.includes(DUMP_HEADER)) {
    throw new BackupError("The database file in this archive is not a PostgreSQL backup.");
  }
  if (!tail.includes(DUMP_TRAILER)) {
    throw new BackupError(
      "The database file in this archive is incomplete. The backup was probably cut off while it was being created, downloaded or copied."
    );
  }

  const schemaMatch = head.match(/^CREATE SCHEMA ("(?:[^"]|"")+"|[A-Za-z_][A-Za-z0-9_$]*);$/m);
  const versionMatch = head.match(/^-- Dumped from database version (.+)$/m);
  return {
    schema: schemaMatch ? unquoteIdent(schemaMatch[1]) : null,
    serverVersion: versionMatch ? versionMatch[1].trim() : null,
  };
}

async function archiveIsGzipped(filePath: string): Promise<boolean> {
  const handle = await fsp.open(filePath, "r");
  try {
    const head = Buffer.alloc(512);
    const { bytesRead } = await handle.read(head, 0, head.length, 0);
    if (bytesRead >= 2 && head[0] === 0x1f && head[1] === 0x8b) return true;
    if (bytesRead >= 262 && head.toString("latin1", 257, 262) === "ustar") return false;
  } finally {
    await handle.close();
  }
  throw new BackupError(
    "This file is not a backup archive. Use a .tar.gz file downloaded from Backup History. Nothing was changed."
  );
}

/** Rejects anything a backup made by this site never contains: links, devices and so on. */
async function assertPlainFilesOnly(dir: string): Promise<void> {
  for (const entry of await fsp.readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      await assertPlainFilesOnly(path.join(dir, entry.name));
    } else if (!entry.isFile()) {
      throw new BackupError(
        "This archive contains links or special files, which a backup made by this site never has. Nothing was changed."
      );
    }
  }
}

async function readManifest(filePath: string): Promise<BackupManifest | null> {
  try {
    const parsed: unknown = JSON.parse(await fsp.readFile(filePath, "utf8"));
    return parsed && typeof parsed === "object" ? (parsed as BackupManifest) : null;
  } catch {
    return null;
  }
}

/** Unpacks an archive into workDir and checks it is a complete, safe backup. Changes nothing else. */
async function unpackBackup(archivePath: string, workDir: string): Promise<UnpackedBackup> {
  const gzipped = await archiveIsGzipped(archivePath);

  let listing: string;
  try {
    listing = await run("tar", [gzipped ? "-tzf" : "-tf", archivePath]);
  } catch {
    throw new BackupError(
      "This file is damaged or incomplete, so it could not be opened. If it was downloaded, download it again. Nothing was changed."
    );
  }
  for (const entry of listing.split("\n").map((line) => line.trim()).filter(Boolean)) {
    if (path.isAbsolute(entry) || entry.split(/[\\/]/).includes("..")) {
      throw new BackupError("This archive contains unsafe file paths. Nothing was changed.");
    }
  }

  try {
    await run("tar", [gzipped ? "-xzf" : "-xf", archivePath, "-C", workDir]);
  } catch {
    throw new BackupError("This archive could not be unpacked. It may be damaged. Nothing was changed.");
  }
  await assertPlainFilesOnly(workDir);

  const sqlPath = path.join(workDir, "database.sql");
  if (!(await pathExists(sqlPath))) {
    throw new BackupError(
      "This archive has no database in it (database.sql is missing), so it is not a backup made by this site. Nothing was changed."
    );
  }
  const imagesDir = path.join(workDir, "uploads");

  return {
    sqlPath,
    imagesDir: (await pathExists(imagesDir)) ? imagesDir : null,
    manifest: await readManifest(path.join(workDir, "manifest.json")),
    dump: await inspectDump(sqlPath),
  };
}

async function appVersion(): Promise<string | undefined> {
  try {
    const pkg = JSON.parse(await fsp.readFile(path.join(process.cwd(), "package.json"), "utf8"));
    return typeof pkg.version === "string" ? pkg.version : undefined;
  } catch {
    return undefined;
  }
}

// ─────────────────────────────────────────────
// Backup
// ─────────────────────────────────────────────

export type BackupRecord = Backup;

type CreateBackupOptions = {
  type: BackupType;
  userId?: string;
  /** How many completed backups to keep. Defaults to the "Keep last N backups" setting; 0 keeps all. */
  retention?: number;
};

export function createBackup(opts: CreateBackupOptions): Promise<BackupRecord> {
  return exclusively("backup", () => createBackupNow(opts));
}

async function createBackupNow(opts: CreateBackupOptions): Promise<BackupRecord> {
  const target = currentTarget();
  await fsp.mkdir(BACKUP_DIR, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `backup-${timestamp}-${randomUUID().slice(0, 8)}.tar.gz`;
  const finalPath = path.join(BACKUP_DIR, filename);
  // Written under a temporary name and renamed once verified, so an unfinished
  // archive never looks like a finished one.
  const partialPath = `${finalPath}.partial`;
  const workDir = path.join(os.tmpdir(), `hala-backup-${randomUUID()}`);

  const record = await prisma.backup.create({
    data: {
      filename,
      type: opts.type,
      status: BackupStatus.IN_PROGRESS,
      createdById: opts.userId,
    },
  });

  let completed: BackupRecord;
  try {
    await fsp.mkdir(workDir, { recursive: true });

    // 1. The full schema and data as portable SQL.
    const sqlPath = path.join(workDir, "database.sql");
    await runDatabaseTool(
      "pg_dump",
      [
        target.pgUrl,
        "--no-owner",
        "--no-privileges",
        "--clean",
        "--if-exists",
        "--lock-wait-timeout=60s",
        "--schema",
        target.schema,
      ],
      { outputPath: sqlPath }
    );
    const dump = await inspectDump(sqlPath);

    // 2. Product images (the only writable, non-git directory).
    const includesFiles = await buildProductImagesSnapshot(path.join(workDir, "uploads"));

    const manifest: BackupManifest = {
      format: ARCHIVE_FORMAT,
      createdAt: new Date().toISOString(),
      type: opts.type,
      includesFiles,
      appVersion: await appVersion(),
      schema: target.schema,
      databaseVersion: dump.serverVersion ?? undefined,
    };
    await fsp.writeFile(path.join(workDir, "manifest.json"), JSON.stringify(manifest, null, 2));

    // 3. One portable archive, read back once before it counts as complete.
    await run("tar", ["-czf", partialPath, "-C", workDir, "."]);
    await run("tar", ["-tzf", partialPath], { discardOutput: true });
    await fsp.rename(partialPath, finalPath);
    const { size } = await fsp.stat(finalPath);

    completed = await prisma.backup.update({
      where: { id: record.id },
      data: {
        status: BackupStatus.COMPLETED,
        sizeBytes: BigInt(size),
        includesFiles,
        completedAt: new Date(),
      },
    });
  } catch (e) {
    await fsp.rm(partialPath, { force: true }).catch(() => {});
    await fsp.rm(finalPath, { force: true }).catch(() => {});
    await prisma.backup
      .update({
        where: { id: record.id },
        data: { status: BackupStatus.FAILED, errorMessage: describeBackupError(e).slice(0, 1000) },
      })
      .catch(() => {});
    throw e;
  } finally {
    await fsp.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }

  try {
    await enforceRetention(opts.retention ?? (await configuredRetention()));
  } catch (e) {
    console.error("[backup] could not remove old backups:", e);
  }
  return completed;
}

async function configuredRetention(): Promise<number> {
  const row = await prisma.setting.findUnique({ where: { key: "backup_retention_count" } }).catch(() => null);
  const count = row ? parseInt(row.value, 10) : NaN;
  return Number.isFinite(count) && count > 0 ? count : DEFAULT_RETENTION;
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

/** Marks backups left "in progress" by a server restart as failed and removes their unfinished files. */
export async function failInterruptedBackups(): Promise<void> {
  if (jobState.__halaBackupJob) return;
  const stale = await prisma.backup.findMany({
    where: {
      status: BackupStatus.IN_PROGRESS,
      createdAt: { lt: new Date(Date.now() - INTERRUPTED_AFTER_MS) },
    },
  });
  for (const b of stale) {
    await fsp.rm(path.join(BACKUP_DIR, `${b.filename}.partial`), { force: true }).catch(() => {});
    await prisma.backup.update({
      where: { id: b.id },
      data: {
        status: BackupStatus.FAILED,
        errorMessage: "Interrupted: the server stopped while this backup was being created.",
      },
    });
  }
}

// ─────────────────────────────────────────────
// Restore
// ─────────────────────────────────────────────

export type RestoreOptions = {
  /** Also replace the product images with the archive's copy (default true). */
  restoreFiles?: boolean;
  /** The admin running the restore, recorded on the safety backup. */
  userId?: string;
  /** That admin's session token, kept valid across the restore when their account exists in the backup. */
  sessionToken?: string;
};

export type RestoreResult = {
  /** When the restored backup was made (from its manifest), if known. */
  backupCreatedAt: string | null;
  /** The backup of the previous data taken right before the restore. */
  safetyBackupId: string;
  /** Statements applied to bring the restored database up to this version of the site. */
  schemaUpdates: number;
  filesRestored: boolean;
  /** Whether the admin who ran the restore is still signed in. */
  signedIn: boolean;
  /** Follow-up steps that did not complete. The data itself was restored. */
  warnings: string[];
};

/** Server-owned state that a restore must not roll back. */
type ServerState = {
  backups: Backup[];
  settings: Setting[];
  session: Session | null;
};

async function captureServerState(sessionToken?: string): Promise<ServerState> {
  const [backups, settings, session] = await Promise.all([
    prisma.backup.findMany(),
    prisma.setting.findMany({ where: { key: { in: BACKUP_SETTING_KEYS } } }),
    sessionToken ? prisma.session.findUnique({ where: { token: sessionToken } }) : Promise.resolve(null),
  ]);
  return { backups, settings, session };
}

/**
 * Puts server-owned state back after a restore replaced every table:
 * - the backup history, which must list the archives on disk now (including
 *   the safety backup), not the ones that existed when the backup was made;
 * - the backup schedule settings;
 * - the restoring admin's sign-in, when that account exists in the restored data.
 * Returns whether the admin is still signed in.
 */
async function reapplyServerState(state: ServerState, warnings: string[]): Promise<boolean> {
  try {
    const creatorIds = [
      ...new Set(state.backups.map((b) => b.createdById).filter((id): id is string => Boolean(id))),
    ];
    const creators = await prisma.user.findMany({ where: { id: { in: creatorIds } }, select: { id: true } });
    const knownCreators = new Set(creators.map((u) => u.id));

    await prisma.$transaction([
      prisma.backup.deleteMany({}),
      prisma.backup.createMany({
        data: state.backups.map((b) => ({
          ...b,
          createdById: b.createdById && knownCreators.has(b.createdById) ? b.createdById : null,
        })),
      }),
      prisma.setting.deleteMany({ where: { key: { in: BACKUP_SETTING_KEYS } } }),
      prisma.setting.createMany({
        data: state.settings.map((s) => ({
          key: s.key,
          value: s.value,
          type: s.type,
          group: s.group,
          labelEn: s.labelEn,
          labelAr: s.labelAr,
          updatedAt: s.updatedAt,
        })),
      }),
    ]);
  } catch (e) {
    console.error("[backup] could not carry over the backup history after a restore:", e);
    warnings.push(`The backup history and schedule could not be carried over: ${describeBackupError(e)}`);
  }

  const session = state.session;
  if (!session) return false;
  try {
    const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { isActive: true } });
    if (!user?.isActive) return false;
    await prisma.session.upsert({
      where: { token: session.token },
      update: { userId: session.userId, expiresAt: session.expiresAt, lockedAt: session.lockedAt },
      create: {
        token: session.token,
        userId: session.userId,
        expiresAt: session.expiresAt,
        lockedAt: session.lockedAt,
        createdAt: session.createdAt,
      },
    });
    return true;
  } catch (e) {
    console.error("[backup] could not keep the admin signed in after a restore:", e);
    return false;
  }
}

function assertNonDestructive(upgradeSql: string): void {
  const destructive = destructiveStatements(upgradeSql);
  if (destructive.length > 0) {
    throw new BackupError(
      `This backup was made by a newer or different version of the site. Using it here would remove data (${destructive
        .slice(0, 3)
        .join(" ")}). Nothing was changed.`
    );
  }
}

/** Fallback when no rehearsal was possible: update the schema after the restore, in its own transaction. */
async function upgradeInPlace(target: DbTarget, warnings: string[]): Promise<number> {
  try {
    const sql = await schemaUpgradeSql(target);
    const destructive = destructiveStatements(sql);
    if (destructive.length > 0) {
      warnings.push(
        `The database structure was not updated, because that would remove data: ${destructive.slice(0, 3).join(" ")}`
      );
      return 0;
    }
    if (sql) await runInTransaction(target, [sql]);
    return sqlStatementCount(sql);
  } catch (e) {
    warnings.push(
      `The database structure could not be updated for this version of the site: ${describeBackupError(e)} If pages show errors, restore the "Before restore" backup.`
    );
    return 0;
  }
}

/**
 * Restores a backup archive. Steps, in order:
 * 1. Unpack and check the archive (complete, safe, made for this schema).
 * 2. Rehearse on a temporary database: load it and bring it up to this
 *    version's schema. Problems surface here, before live data is touched.
 * 3. Save a safety backup of the current data.
 * 4. Replace the data and upgrade the schema in one transaction.
 * 5. Carry over server-owned state, then restore the product images.
 * Any failure up to and including step 4 leaves the current data unchanged.
 */
export function restoreBackup(archivePath: string, opts: RestoreOptions = {}): Promise<RestoreResult> {
  return exclusively("restore", () => restoreNow(archivePath, opts));
}

async function restoreNow(archivePath: string, opts: RestoreOptions): Promise<RestoreResult> {
  const target = currentTarget();
  const workDir = path.join(os.tmpdir(), `hala-restore-${randomUUID()}`);
  await fsp.mkdir(workDir, { recursive: true });
  const warnings: string[] = [];

  try {
    // 1. Check the archive.
    const backup = await unpackBackup(archivePath, workDir);
    if (backup.dump.schema && backup.dump.schema !== target.schema) {
      throw new BackupError(
        `This backup holds the database schema "${backup.dump.schema}", but this site uses "${target.schema}". Nothing was changed.`
      );
    }
    const reset = schemaResetSql(target.schema);

    // 2. Rehearse. upgradeSql stays null only when no rehearsal was possible.
    let upgradeSql: string | null = null;
    const scratch = await createScratchDatabase(target);
    if (scratch) {
      try {
        try {
          await runInTransaction(scratch, [reset, { file: backup.sqlPath }]);
        } catch (e) {
          throw new BackupError(`This backup could not be loaded, so nothing was changed. ${describeBackupError(e)}`);
        }
        try {
          upgradeSql = await schemaUpgradeSql(scratch);
        } catch (e) {
          throw new BackupError(
            `This backup could not be compared with the current version of the site, so nothing was changed. ${describeBackupError(e)}`,
            500
          );
        }
        assertNonDestructive(upgradeSql);
        if (upgradeSql) {
          try {
            await runInTransaction(scratch, [upgradeSql]);
          } catch (e) {
            throw new BackupError(
              `The data in this backup does not fit the current version of the site, so nothing was changed. ${describeBackupError(e)}`
            );
          }
        }
      } finally {
        await dropDatabase(target, scratch.database).catch((e) =>
          console.error("[backup] could not remove the temporary restore database:", e)
        );
      }
    } else {
      warnings.push(
        "The backup could not be test-loaded first, because the database user may not create databases. It was restored directly."
      );
    }

    // 3. Save the current data, so this restore can be undone.
    let safety: BackupRecord;
    try {
      safety = await createBackupNow({ type: BackupType.PRE_RESTORE, userId: opts.userId, retention: 0 });
    } catch (e) {
      throw new BackupError(
        `Could not save a safety backup of the current data, so the restore was not started. ${describeBackupError(e)}`,
        500
      );
    }
    const serverState = await captureServerState(opts.sessionToken);

    // 4. Replace everything in one transaction: all of it applies, or none of it.
    const parts: SqlPart[] = [reset, { file: backup.sqlPath }];
    if (upgradeSql) {
      // The dump empties search_path; the upgrade SQL uses unqualified names.
      parts.push(`SET search_path TO ${quoteIdent(target.schema)};`, upgradeSql);
    }
    try {
      await runInTransaction(target, parts);
    } catch (e) {
      throw new BackupError(
        `The restore failed and was rolled back, so your data was not changed. ${describeBackupError(e)}`,
        500
      );
    }

    // Pooled connections still hold query plans for the replaced tables and types.
    await prisma.$disconnect().catch(() => {});

    const schemaUpdates =
      upgradeSql === null ? await upgradeInPlace(target, warnings) : sqlStatementCount(upgradeSql);

    // 5. Server-owned state, then the images.
    const signedIn = await reapplyServerState(serverState, warnings);

    let filesRestored = false;
    if (opts.restoreFiles !== false) {
      try {
        filesRestored = await restoreProductImages(backup.imagesDir);
      } catch (e) {
        console.error("[backup] could not restore product images:", e);
        warnings.push(`The database was restored, but the product images could not be: ${describeBackupError(e)}`);
      }
    }

    return {
      backupCreatedAt: typeof backup.manifest?.createdAt === "string" ? backup.manifest.createdAt : null,
      safetyBackupId: safety.id,
      schemaUpdates,
      filesRestored,
      signedIn,
      warnings,
    };
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
