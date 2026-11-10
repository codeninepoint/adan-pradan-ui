"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { useVendorPortal } from "@/components/vendor/portal";
import { ApiError, marketplaceApi, VendorGrowthPluginItem } from "@/lib/api";

function Toggle({
  checked,
  disabled,
  onChange,
  label,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        checked ? "bg-emerald-500" : "bg-border"
      }`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

export default function VendorPluginSettingsPage() {
  const { vendor } = useVendorPortal();
  const { ensureAccessToken } = useAuth();
  const [items, setItems] = useState<VendorGrowthPluginItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!vendor) return;
    const data = await marketplaceApi.vendorGrowthPlugins(vendor.vendor_id, ensureAccessToken);
    setItems(data.items);
  }, [vendor, ensureAccessToken]);

  useEffect(() => {
    void load().catch((err: unknown) =>
      setError(err instanceof ApiError ? err.detail : "Could not load plugin settings."),
    );
  }, [load]);

  async function patch(item: VendorGrowthPluginItem, body: Parameters<typeof marketplaceApi.updateVendorGrowthPlugin>[2]) {
    if (!vendor) return;
    setBusy(item.key);
    setError(null);
    try {
      const updated = await marketplaceApi.updateVendorGrowthPlugin(vendor.vendor_id, item.key, body, ensureAccessToken);
      setItems((current) => current.map((row) => (row.key === updated.key ? updated : row)));
      setMessage(`${updated.name} settings saved.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Could not save settings.");
    } finally {
      setBusy(null);
    }
  }

  if (!vendor) return null;

  const imported = items.filter((item) => item.installation_status !== "not_imported");

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">Plugin Settings</p>
      <h1 className="mt-1 text-2xl font-bold tracking-tight">Plugin Settings</h1>
      <p className="mt-1 text-sm text-muted">Control which modules are active for your storefront</p>

      {message && <p className="mt-4 text-sm font-semibold text-emerald-600">{message}</p>}
      {error && <p className="mt-4 text-sm text-error">{error}</p>}

      {imported.length === 0 && (
        <div className="mt-6 rounded-xl border border-border bg-surface p-6">
          <p className="text-sm text-muted">No standard plugins imported yet.</p>
          <Link href="/app/vendor/plugin-store" className="mt-3 inline-block text-sm font-semibold text-primary hover:underline">
            Browse the Plugin Store →
          </Link>
        </div>
      )}

      <div className="mt-6 space-y-6">
        {imported.map((item) => (
          <section key={item.key} className="overflow-hidden rounded-xl border border-border bg-surface">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
              <div>
                <h2 className="font-bold">{item.name}</h2>
                <p className="text-xs text-muted">
                  {item.connection?.business_display_name ? `${String(item.connection.business_display_name)} · ` : ""}
                  Imported {item.imported_at ? new Date(item.imported_at).toLocaleDateString("en-IN") : ""}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {(item.key === "sales-pipeline" || item.key === "digital-marketing" || item.key === "publicity") &&
                  item.installation_status === "active" && (
                    <Link
                      href={
                        item.key === "sales-pipeline"
                          ? "/app/vendor/sales-pipeline"
                          : item.key === "digital-marketing"
                            ? "/app/vendor/digital-marketing"
                            : "/app/vendor/publicity"
                      }
                      className="text-xs font-semibold text-primary hover:underline"
                    >
                      {item.key === "sales-pipeline" ? "Open board →" : item.key === "digital-marketing" ? "Open dashboard →" : "Open studio →"}
                    </Link>
                  )}
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                    item.installation_status === "active" ? "bg-emerald-500/15 text-emerald-600" : "bg-background text-muted"
                  }`}
                >
                  {item.installation_status === "active" ? "Active" : "Inactive"}
                </span>
                <Toggle
                  label={`${item.name} active`}
                  checked={item.installation_status === "active"}
                  disabled={busy !== null}
                  onChange={(next) => void patch(item, { status: next ? "active" : "inactive" })}
                />
              </div>
            </header>
            <div className="divide-y divide-border">
              {item.vendor_modules.map((module) => (
                <div key={module.key} className="flex items-center justify-between gap-3 px-5 py-3.5">
                  <div>
                    <p className="text-sm font-semibold">
                      {module.label}
                      {module.badge && (
                        <span className="ml-2 rounded-full bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-bold text-violet-600">{module.badge}</span>
                      )}
                    </p>
                    <p className="text-xs text-muted">
                      {module.platform_enabled ? module.description : "Disabled by your platform admin — cannot be enabled here"}
                    </p>
                  </div>
                  <Toggle
                    label={module.label}
                    checked={module.enabled}
                    disabled={!module.platform_enabled || busy !== null || item.installation_status !== "active"}
                    onChange={(next) =>
                      void patch(item, {
                        modules: item.vendor_modules.map((row) => ({
                          key: row.key,
                          label: row.label,
                          enabled: row.key === module.key ? next : row.enabled,
                        })),
                      })
                    }
                  />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      {items.some((item) => item.installation_status === "not_imported") && (
        <p className="mt-6 text-sm text-muted">
          Looking for more modules?{" "}
          <Link href="/app/vendor/plugin-store" className="font-semibold text-primary hover:underline">
            Import another Standard Plugin →
          </Link>
        </p>
      )}
    </div>
  );
}
