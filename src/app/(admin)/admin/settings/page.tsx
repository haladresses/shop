"use client";
import { useEffect, useState } from "react";
import { LuCheck } from "react-icons/lu";
import FooterSettings from "@/components/admin/FooterSettings";

const DEFAULT_SETTINGS = [
  { key: "store_name_en", group: "general", labelEn: "Store Name (English)", type: "string", defaultValue: "Hala Dresses" },
  { key: "store_name_ar", group: "general", labelEn: "Store Name (Arabic)", type: "string", defaultValue: "هلا دريسز" },
  { key: "store_email", group: "general", labelEn: "Store Email", type: "string", defaultValue: "info@haladresses.com" },
  { key: "store_phone", group: "general", labelEn: "Store Phone", type: "string", defaultValue: "+968 9000 0000" },
  { key: "store_address", group: "general", labelEn: "Store Address", type: "string", defaultValue: "Muscat, Oman" },
  { key: "free_shipping_min", group: "shipping", labelEn: "Free Shipping Min Order (OMR)", type: "string", defaultValue: "10" },
  { key: "default_shipping_cost", group: "shipping", labelEn: "Default Shipping Cost (OMR)", type: "string", defaultValue: "1.500" },
  { key: "currency", group: "general", labelEn: "Currency Code", type: "string", defaultValue: "OMR" },
  { key: "tax_rate", group: "general", labelEn: "Tax Rate (%)", type: "string", defaultValue: "5" },
  { key: "maintenance_mode", group: "general", labelEn: "Maintenance Mode", type: "boolean", defaultValue: "false" },
  { key: "allow_guest_checkout", group: "checkout", labelEn: "Allow Guest Checkout", type: "boolean", defaultValue: "true" },
  { key: "order_notification_email", group: "notifications", labelEn: "Order Notification Email", type: "string", defaultValue: "" },
  { key: "instagram_url", group: "social", labelEn: "Instagram URL", type: "string", defaultValue: "" },
  { key: "facebook_url", group: "social", labelEn: "Facebook URL", type: "string", defaultValue: "" },
  { key: "whatsapp_number", group: "social", labelEn: "WhatsApp Number", type: "string", defaultValue: "" },
];

const groups = ["general", "shipping", "checkout", "notifications", "social", "footer"];

export default function SettingsPage() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeGroup, setActiveGroup] = useState("general");

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          const mapped: Record<string, string> = {};
          DEFAULT_SETTINGS.forEach((s) => {
            mapped[s.key] = String(d.data[s.key] ?? s.defaultValue);
          });
          setValues(mapped);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const data = await res.json();
    if (data.success) { setSaved(true); setTimeout(() => setSaved(false), 3000); }
    setSaving(false);
  };

  const groupSettings = DEFAULT_SETTINGS.filter((s) => s.group === activeGroup);

  if (loading) return <div className="flex justify-center py-12"><div className="spinner" /></div>;

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Group Tabs */}
      <div className="flex gap-2 flex-wrap">
        {groups.map((g) => (
          <button
            key={g}
            onClick={() => setActiveGroup(g)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
              activeGroup === g ? "bg-indigo-600 text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            {g}
          </button>
        ))}
      </div>

      {activeGroup === "footer" ? (
        <FooterSettings />
      ) : (
        <>
          <div className="admin-card p-6">
        <div className="space-y-5">
          {groupSettings.map((setting) => (
            <div key={setting.key}>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">{setting.labelEn}</label>
              {setting.type === "boolean" ? (
                <label className="flex items-center gap-2 cursor-pointer">
                  <div
                    className={`w-11 h-6 rounded-full transition-colors cursor-pointer ${values[setting.key] === "true" ? "bg-indigo-600" : "bg-slate-200"}`}
                    onClick={() => setValues({ ...values, [setting.key]: values[setting.key] === "true" ? "false" : "true" })}
                  >
                    <div className={`w-5 h-5 bg-white rounded-full shadow mt-0.5 transition-transform ${values[setting.key] === "true" ? "ml-5.5 translate-x-5" : "translate-x-0.5"}`} />
                  </div>
                  <span className="text-sm text-slate-600">{values[setting.key] === "true" ? "Enabled" : "Disabled"}</span>
                </label>
              ) : (
                <input
                  className="admin-input"
                  value={values[setting.key] || ""}
                  onChange={(e) => setValues({ ...values, [setting.key]: e.target.value })}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving} className="admin-btn admin-btn-primary px-8">
          {saving ? "Saving..." : "Save Settings"}
        </button>
        {saved && (
          <span className="text-green-600 text-sm font-medium flex items-center gap-1">
            <LuCheck size={16} /> Settings saved!
          </span>
        )}
      </div>
        </>
      )}
    </div>
  );
}
