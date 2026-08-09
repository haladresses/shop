"use client";

import { useEffect, useState } from "react";
import { LuCheck, LuCreditCard, LuShieldAlert, LuPlugZap } from "react-icons/lu";

type ThawaniSettings = {
  enabled: boolean;
  mode: "uat" | "production";
  secretKey: string;
  publishableKey: string;
  savedAt?: string | null;
  lastTestedAt?: string | null;
  lastTestOk?: boolean | null;
  lastTestMessage?: string | null;
};

const DEFAULT_SETTINGS: ThawaniSettings = {
  enabled: false,
  mode: "uat",
  secretKey: "",
  publishableKey: "",
  savedAt: null,
  lastTestedAt: null,
  lastTestOk: null,
  lastTestMessage: null,
};

function formatDateTime(value?: string | null) {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Never";
  return date.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

export default function PaymentGatewaySettings() {
  const [settings, setSettings] = useState<ThawaniSettings>(DEFAULT_SETTINGS);
  const [baselineSettings, setBaselineSettings] = useState<ThawaniSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/admin/payments/settings")
      .then((r) => r.json())
      .then((d) => {
        if (!d.success) throw new Error(d.error || "Failed to load gateway settings.");
        const nextSettings = { ...DEFAULT_SETTINGS, ...d.data };
        setSettings(nextSettings);
        setBaselineSettings(nextSettings);
      })
      .catch((e: Error) => setMessage({ type: "error", text: e.message }))
      .finally(() => setLoading(false));
  }, []);

  const dirty =
    settings.enabled !== baselineSettings.enabled ||
    settings.mode !== baselineSettings.mode ||
    settings.secretKey !== baselineSettings.secretKey ||
    settings.publishableKey !== baselineSettings.publishableKey;

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/payments/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to save gateway settings.");
      const nextSettings = { ...DEFAULT_SETTINGS, ...data.data };
      setSettings(nextSettings);
      setBaselineSettings(nextSettings);
      setMessage({ type: "success", text: "Payment gateway settings saved." });
    } catch (e) {
      setMessage({ type: "error", text: e instanceof Error ? e.message : "Failed to save gateway settings." });
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/payments/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to test gateway connection.");
      setSettings((current) => ({
        ...current,
        lastTestedAt: new Date().toISOString(),
        lastTestOk: Boolean(data.data.ok),
        lastTestMessage: data.data.message || "Connection test completed.",
      }));
      setTestResult({ ok: Boolean(data.data.ok), text: data.data.message || "Connection test completed." });
    } catch (e) {
      setTestResult({ ok: false, text: e instanceof Error ? e.message : "Failed to test gateway connection." });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="admin-card p-6">
        <div className="flex justify-center py-8">
          <div className="spinner" />
        </div>
      </div>
    );
  }

  return (
    <div className="admin-card border border-slate-200 p-6 space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            <LuCreditCard size={14} /> Thawani Gateway
          </div>
          <h3 className="mt-3 text-lg font-semibold text-slate-800">Payment Gateway Configuration</h3>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Manage the live Thawani gateway connection from admin. These credentials are stored in the database and are no longer read from `.env`.
          </p>
        </div>
        <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${settings.enabled ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-600"}`}>
          {settings.enabled ? "Enabled" : "Disabled"}
        </span>
      </div>

      {message && (
        <div className={`rounded-2xl px-4 py-3 text-sm font-medium ${message.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
          {message.text}
        </div>
      )}

      {testResult && (
        <div className={`rounded-2xl px-4 py-3 text-sm font-medium ${testResult.ok ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
          {testResult.text}
        </div>
      )}

      <div className="flex gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <LuShieldAlert size={16} className="mt-0.5 shrink-0" />
        <span>Only users with payment management permission should edit this section. Make sure the mode and keys belong to the same Thawani environment.</span>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Last Saved</div>
          <div className="mt-2 text-sm font-semibold text-slate-800">{formatDateTime(settings.savedAt)}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Last Test</div>
          <div className="mt-2 text-sm font-semibold text-slate-800">{formatDateTime(settings.lastTestedAt)}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Last Test Result</div>
          <div className={`mt-2 text-sm font-semibold ${settings.lastTestOk === null ? "text-slate-500" : settings.lastTestOk ? "text-emerald-700" : "text-rose-700"}`}>
            {settings.lastTestOk === null ? "No test recorded" : settings.lastTestOk ? "Passed" : "Failed"}
          </div>
          {settings.lastTestMessage && <div className="mt-2 text-xs leading-5 text-slate-500">{settings.lastTestMessage}</div>}
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Gateway Status</label>
          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(e) => setSettings((current) => ({ ...current, enabled: e.target.checked }))}
              className="h-4 w-4 rounded border-slate-300"
            />
            <span className="text-sm text-slate-600">Enable Thawani card payments at checkout</span>
          </label>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Mode</label>
          <select
            value={settings.mode}
            onChange={(e) => setSettings((current) => ({ ...current, mode: e.target.value === "production" ? "production" : "uat" }))}
            className="admin-input admin-select"
          >
            <option value="uat">UAT / Sandbox</option>
            <option value="production">Production</option>
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Secret Key</label>
          <input
            type="password"
            value={settings.secretKey}
            onChange={(e) => setSettings((current) => ({ ...current, secretKey: e.target.value }))}
            className="admin-input"
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Publishable Key</label>
          <input
            type="password"
            value={settings.publishableKey}
            onChange={(e) => setSettings((current) => ({ ...current, publishableKey: e.target.value }))}
            className="admin-input"
            autoComplete="off"
            spellCheck={false}
          />
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="font-medium text-slate-800">Validate the current gateway form before saving live checkout settings.</div>
          <div className="mt-1 text-sm text-slate-500">Run a connection test first, then save once the configuration is confirmed.</div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            <span className={`h-2 w-2 rounded-full ${dirty ? "bg-amber-400" : "bg-emerald-400"}`} /> Changes {dirty ? "pending" : "ready"}
          </div>
          <button onClick={testConnection} disabled={testing || saving} className="inline-flex min-w-40 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition-colors duration-200 hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400">
            {testing ? "Testing..." : <><LuPlugZap size={15} /> Test Connection</>}
          </button>
          <button onClick={save} disabled={saving || testing} className="inline-flex min-w-36 items-center justify-center gap-2 rounded-full bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300">
            {saving ? "Saving..." : <><LuCheck size={15} /> Save Gateway</>}
          </button>
        </div>
      </div>
    </div>
  );
}