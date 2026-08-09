import prisma from "@/lib/db";

export const THAWANI_SETTINGS_KEY = "thawani_gateway_settings_v1";
export const THAWANI_SETTINGS_META_KEY = "thawani_gateway_settings_meta_v1";
export const THAWANI_UAT_BASE = "https://uatcheckout.thawani.om";
export const THAWANI_PROD_BASE = "https://checkout.thawani.om";

export type ThawaniMode = "uat" | "production";

export type ThawaniSettings = {
  enabled: boolean;
  mode: ThawaniMode;
  secretKey: string;
  publishableKey: string;
  savedAt?: string | null;
  lastTestedAt?: string | null;
  lastTestOk?: boolean | null;
  lastTestMessage?: string | null;
};

export type ThawaniConnectionTestResult = {
  ok: boolean;
  message: string;
  code?: number;
  baseUrl: string;
  mode: ThawaniMode;
};

const DEFAULT_THAWANI_SETTINGS: ThawaniSettings = {
  enabled: false,
  mode: "uat",
  secretKey: "",
  publishableKey: "",
  savedAt: null,
  lastTestedAt: null,
  lastTestOk: null,
  lastTestMessage: null,
};

type ThawaniSettingsMeta = {
  lastTestedAt: string | null;
  lastTestOk: boolean | null;
  lastTestMessage: string | null;
};

function normalizeThawaniSettingsMeta(input: unknown): ThawaniSettingsMeta {
  if (!input || typeof input !== "object") {
    return { lastTestedAt: null, lastTestOk: null, lastTestMessage: null };
  }

  const record = input as Record<string, unknown>;
  return {
    lastTestedAt: typeof record.lastTestedAt === "string" ? record.lastTestedAt : null,
    lastTestOk: typeof record.lastTestOk === "boolean" ? record.lastTestOk : null,
    lastTestMessage: typeof record.lastTestMessage === "string" ? record.lastTestMessage : null,
  };
}

export function normalizeThawaniSettings(input: unknown): ThawaniSettings {
  if (!input || typeof input !== "object") return { ...DEFAULT_THAWANI_SETTINGS };
  const record = input as Record<string, unknown>;
  return {
    enabled: Boolean(record.enabled),
    mode: record.mode === "production" ? "production" : "uat",
    secretKey: typeof record.secretKey === "string" ? record.secretKey.trim() : "",
    publishableKey: typeof record.publishableKey === "string" ? record.publishableKey.trim() : "",
    savedAt: typeof record.savedAt === "string" ? record.savedAt : null,
    lastTestedAt: typeof record.lastTestedAt === "string" ? record.lastTestedAt : null,
    lastTestOk: typeof record.lastTestOk === "boolean" ? record.lastTestOk : null,
    lastTestMessage: typeof record.lastTestMessage === "string" ? record.lastTestMessage : null,
  };
}

export async function getThawaniSettings(): Promise<ThawaniSettings> {
  const [row, metaRow] = await Promise.all([
    prisma.setting.findUnique({ where: { key: THAWANI_SETTINGS_KEY } }),
    prisma.setting.findUnique({ where: { key: THAWANI_SETTINGS_META_KEY } }),
  ]);
  if (!row) {
    const meta = metaRow ? normalizeThawaniSettingsMeta(JSON.parse(metaRow.value)) : null;
    return { ...DEFAULT_THAWANI_SETTINGS, ...meta };
  }

  try {
    const settings = normalizeThawaniSettings(JSON.parse(row.value));
    const meta = metaRow ? normalizeThawaniSettingsMeta(JSON.parse(metaRow.value)) : null;
    return {
      ...settings,
      savedAt: row.updatedAt.toISOString(),
      ...(meta || {}),
    };
  } catch {
    return { ...DEFAULT_THAWANI_SETTINGS };
  }
}

export async function saveThawaniSettings(settings: ThawaniSettings): Promise<ThawaniSettings> {
  const normalized = normalizeThawaniSettings(settings);
  const row = await prisma.setting.upsert({
    where: { key: THAWANI_SETTINGS_KEY },
    update: {
      value: JSON.stringify({
        enabled: normalized.enabled,
        mode: normalized.mode,
        secretKey: normalized.secretKey,
        publishableKey: normalized.publishableKey,
      }),
      type: "json",
      group: "payments",
      labelEn: "Thawani gateway settings",
      labelAr: "إعدادات بوابة ثواني",
    },
    create: {
      key: THAWANI_SETTINGS_KEY,
      value: JSON.stringify({
        enabled: normalized.enabled,
        mode: normalized.mode,
        secretKey: normalized.secretKey,
        publishableKey: normalized.publishableKey,
      }),
      type: "json",
      group: "payments",
      labelEn: "Thawani gateway settings",
      labelAr: "إعدادات بوابة ثواني",
    },
  });
  return {
    ...normalized,
    savedAt: row.updatedAt.toISOString(),
  };
}

export function getThawaniBaseUrl(mode: ThawaniMode): string {
  return mode === "production" ? THAWANI_PROD_BASE : THAWANI_UAT_BASE;
}

export async function testThawaniSettingsConnection(
  settingsInput: unknown
): Promise<ThawaniConnectionTestResult> {
  const settings = normalizeThawaniSettings(settingsInput);
  const baseUrl = getThawaniBaseUrl(settings.mode);

  if (!settings.secretKey || !settings.publishableKey) {
    return {
      ok: false,
      message: "Secret key and publishable key are required before testing the connection.",
      baseUrl,
      mode: settings.mode,
    };
  }

  try {
    const res = await fetch(`${baseUrl}/api/v1/checkout/session/test-connection`, {
      method: "GET",
      headers: {
        "thawani-api-key": settings.secretKey,
        "Content-Type": "application/json",
      },
    });

    const json = (await res.json().catch(() => null)) as
      | { description?: string; code?: number }
      | null;

    const description = json?.description?.trim();
    const lowered = description?.toLowerCase() || "";
    const authRejected =
      res.status === 401 ||
      res.status === 403 ||
      /unauthor|forbidden|invalid api key|api key|not allowed/.test(lowered);

    if (authRejected) {
      return {
        ok: false,
        message: description || `Thawani rejected the credentials (HTTP ${res.status}).`,
        code: json?.code ?? res.status,
        baseUrl,
        mode: settings.mode,
      };
    }

    return {
      ok: true,
      message:
        description ||
        `Thawani responded successfully in ${settings.mode.toUpperCase()} mode. Credentials and gateway reachability look valid.`,
      code: json?.code ?? res.status,
      baseUrl,
      mode: settings.mode,
    };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Could not reach the Thawani gateway.",
      baseUrl,
      mode: settings.mode,
    };
  }
}

export async function saveThawaniSettingsTestMeta(result: ThawaniConnectionTestResult): Promise<void> {
  await prisma.setting.upsert({
    where: { key: THAWANI_SETTINGS_META_KEY },
    update: {
      value: JSON.stringify({
        lastTestedAt: new Date().toISOString(),
        lastTestOk: result.ok,
        lastTestMessage: result.message,
      }),
      type: "json",
      group: "payments",
      labelEn: "Thawani gateway test metadata",
      labelAr: "بيانات اختبار بوابة ثواني",
    },
    create: {
      key: THAWANI_SETTINGS_META_KEY,
      value: JSON.stringify({
        lastTestedAt: new Date().toISOString(),
        lastTestOk: result.ok,
        lastTestMessage: result.message,
      }),
      type: "json",
      group: "payments",
      labelEn: "Thawani gateway test metadata",
      labelAr: "بيانات اختبار بوابة ثواني",
    },
  });
}