"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { ApiError, platformAdminApi, type GrowthPluginItem, type GrowthPluginModule } from "@/lib/api";

type ConfigValue = string | number | boolean;
type ConfigField =
  | { key: string; label: string; kind: "number"; hint?: string }
  | { key: string; label: string; kind: "text"; hint?: string; placeholder?: string }
  | { key: string; label: string; kind: "select"; options: string[]; hint?: string }
  | { key: string; label: string; kind: "toggle"; hint?: string };

const CONFIG_FIELDS: Record<string, ConfigField[]> = {
  "sales-pipeline": [
    { key: "max_leads_per_vendor_month", label: "Max leads per vendor / month", kind: "number", hint: "Set 0 for unlimited. Overage triggers admin alert." },
    { key: "default_deal_stage_names", label: "Default deal stage names (comma-separated)", kind: "text", hint: "Vendors can rename but cannot delete platform-defined stages." },
    { key: "forecasting_model", label: "Forecasting model", kind: "select", options: ["Platform ML (recommended)", "Simple pipeline weighting", "Manual forecast"] },
    { key: "crm_webhook_endpoint", label: "CRM webhook endpoint (beta)", kind: "text" },
    { key: "vendor_can_customise_stages", label: "Vendor can customise stages", kind: "toggle", hint: "Allow renaming of default kanban columns" },
    { key: "require_deal_value_on_creation", label: "Require deal value on creation", kind: "toggle", hint: "Forces vendors to enter value to improve forecasting" },
  ],
  "digital-marketing": [
    { key: "daily_spend_cap_inr", label: "Platform-wide daily ad spend cap per vendor (₹)", kind: "number", hint: "Vendors set their own lower cap; platform cap is the ceiling." },
    { key: "max_promo_codes_per_vendor", label: "Max promo codes per vendor", kind: "number" },
    { key: "allowed_ad_platforms", label: "Allowed ad platforms", kind: "select", options: ["Meta + Google + TikTok", "Meta + Google", "Meta only", "Google only"] },
    { key: "require_admin_approval_listing_boosts", label: "Require admin approval for Listing Boosts", kind: "toggle", hint: "Boosts go to a queue before going live in search" },
    { key: "allow_influencer_self_onboarding", label: "Allow influencer self-onboarding", kind: "toggle", hint: "Influencers can sign up via public link without vendor invite" },
    { key: "export_race_data", label: "Export RACE data to vendor's BI tool", kind: "toggle", hint: "Enable Looker / Power BI webhook for funnel data" },
  ],
  publicity: [
    { key: "ai_generation_tokens_per_vendor_month", label: "AI generation tokens per vendor / month", kind: "number", hint: "Consumed from platform LLM quota. Soft-limit triggers warning email." },
    { key: "default_press_release_distribution_list", label: "Default press release distribution list", kind: "text", placeholder: "Paste journalist emails, comma-separated" },
    { key: "media_kit_output_format", label: "Media kit output format", kind: "select", options: ["PDF (recommended)", "HTML", "PDF + HTML"] },
    { key: "collect_beta_feedback", label: "Collect beta feedback after each use", kind: "toggle", hint: "Shows 3-question NPS prompt after publish action" },
    { key: "allow_white_label_media_kits", label: "Allow vendors to white-label media kits", kind: "toggle", hint: "Removes platform watermark from generated PDFs" },
  ],
};

const ACCENTS: Record<string, { text: string; bg: string; dot: string }> = {
  "sales-pipeline": { text: "text-amber-500", bg: "bg-amber-500/15", dot: "bg-amber-500" },
  "digital-marketing": { text: "text-sky-500", bg: "bg-sky-500/15", dot: "bg-sky-500" },
  publicity: { text: "text-violet-500", bg: "bg-violet-500/15", dot: "bg-violet-500" },
};

const STAT_COLORS = ["text-amber-500", "text-emerald-500", "text-sky-500", "text-violet-500"];

function PluginIcon({ pluginKey, className = "h-6 w-6" }: { pluginKey: string; className?: string }) {
  if (pluginKey === "sales-pipeline") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden>
        <path d="M3 12h4l2-7 4 14 2-7h6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (pluginKey === "digital-marketing") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden>
        <path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden>
      <path d="M17 8h1a3 3 0 1 1 0 6h-1M4 8h13v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 2v2M11 2v2" strokeLinecap="round" />
    </svg>
  );
}

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
      className={`relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? "bg-emerald-500" : "bg-border"
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? "left-[22px]" : "left-0.5"}`}
      />
    </button>
  );
}

export default function GrowthPluginsPage() {
  const { ensureAccessToken } = useAuth();
  const [items, setItems] = useState<GrowthPluginItem[]>([]);
  const [summary, setSummary] = useState({ total_plugins: 0, total_modules: 0, enabled_plugins: 0, vendors_using: 0 });
  const [filter, setFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [draftModules, setDraftModules] = useState<GrowthPluginModule[]>([]);
  const [draftConfig, setDraftConfig] = useState<Record<string, ConfigValue>>({});
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const data = await platformAdminApi.growthPlugins(ensureAccessToken);
    setItems(data.items);
    setSummary(data.summary);
  }, [ensureAccessToken]);

  useEffect(() => {
    void load()
      .catch((err: unknown) => setError(err instanceof ApiError ? err.detail : "Could not load standard plugins."))
      .finally(() => setLoading(false));
  }, [load]);

  const selected = useMemo(
    () => items.find((item) => item.key === selectedKey) ?? null,
    [items, selectedKey],
  );

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (filter !== "All" && item.group_label !== filter) return false;
      if (statusFilter === "Enabled" && !item.enabled) return false;
      if (statusFilter === "Disabled" && item.enabled) return false;
      if (statusFilter === "Live" && item.lifecycle !== "live") return false;
      if (statusFilter === "Beta" && item.lifecycle !== "beta") return false;
      return true;
    });
  }, [items, filter, statusFilter]);

  function openConfigure(item: GrowthPluginItem) {
    setSelectedKey(item.key);
    setDraftModules(item.modules.map((module) => ({ ...module })));
    setDraftConfig({ ...item.config });
    setError(null);
    setMessage(null);
  }

  function replaceItem(next: GrowthPluginItem) {
    setItems((prev) => prev.map((item) => (item.key === next.key ? next : item)));
    setSummary((prev) => ({
      ...prev,
      enabled_plugins: items.filter((item) => (item.key === next.key ? next.enabled : item.enabled)).length,
    }));
  }

  async function run(key: string, action: () => Promise<void>) {
    setBusy(key);
    setError(null);
    setMessage(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Request failed.");
    } finally {
      setBusy(null);
    }
  }

  async function toggleEnabled(item: GrowthPluginItem, next: boolean) {
    await run(`toggle-${item.key}`, async () => {
      const updated = await platformAdminApi.updateGrowthPlugin(item.key, { enabled: next }, ensureAccessToken);
      replaceItem(updated);
      setMessage(`${updated.name} ${next ? "enabled" : "disabled"}.`);
    });
  }

  async function saveConfiguration() {
    if (!selected) return;
    await run("save-config", async () => {
      const updated = await platformAdminApi.updateGrowthPlugin(
        selected.key,
        { modules: draftModules, config: draftConfig },
        ensureAccessToken,
      );
      replaceItem(updated);
      setMessage(`${updated.name} configuration saved.`);
      setSelectedKey(null);
    });
  }

  async function disableSelected() {
    if (!selected) return;
    await run("disable-selected", async () => {
      const updated = await platformAdminApi.updateGrowthPlugin(selected.key, { enabled: false }, ensureAccessToken);
      replaceItem(updated);
      setMessage(`${updated.name} disabled.`);
      setSelectedKey(null);
    });
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <p className="text-xs font-semibold text-muted">Standard Plugins</p>
      <h1 className="mt-1 text-2xl font-extrabold tracking-tight">Sales &amp; Growth Plugins</h1>
      <p className="mt-1 text-sm text-muted">
        Manage the three built-in growth modules — configure, toggle, and control vendor access
      </p>

      {message && <p className="mt-4 rounded-lg border border-success/30 bg-success/5 px-3 py-2 text-sm text-success">{message}</p>}
      {error && <p className="mt-4 rounded-lg border border-error/30 bg-error/5 px-3 py-2 text-sm text-error">{error}</p>}

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { value: summary.total_plugins, label: "Standard plugins", color: "text-sky-500" },
          { value: summary.vendors_using.toLocaleString("en-IN"), label: "Vendors using", color: "text-emerald-500" },
          { value: summary.enabled_plugins, label: "Enabled", color: "text-amber-500" },
          { value: summary.total_modules, label: "Modules total", color: "text-violet-500" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-border bg-surface p-4">
            <p className={`text-2xl font-extrabold ${stat.color}`}>{loading ? "—" : stat.value}</p>
            <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-muted">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {["All", "Sales", "Marketing", "Publicity"].map((label) => (
          <button
            key={label}
            type="button"
            onClick={() => setFilter(label)}
            className={`cursor-pointer rounded-full px-3.5 py-1.5 text-xs font-bold ${
              filter === label ? "bg-primary text-primary-foreground" : "border border-border bg-surface text-muted hover:text-foreground"
            }`}
          >
            {label}
            {label === "All" ? ` (${items.length})` : ""}
          </button>
        ))}
        <label className="ml-1 text-xs font-semibold text-muted">
          Status:{" "}
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="cursor-pointer rounded-lg border border-border bg-surface px-2 py-1.5 text-xs font-semibold text-foreground"
          >
            {["All", "Live", "Beta", "Enabled", "Disabled"].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <Link
          href="/app/platform-admin/standard-plugins"
          className="ml-auto rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary-hover"
        >
          + New Plugin
        </Link>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {loading ? (
          <p className="col-span-full text-sm text-muted">Loading standard plugins…</p>
        ) : filtered.length === 0 ? (
          <p className="col-span-full text-sm text-muted">No standard plugins match these filters.</p>
        ) : (
          filtered.map((item) => {
            const accent = ACCENTS[item.key] ?? ACCENTS.publicity;
            const vendorsUsing = Number(item.stats.vendors_using ?? 0);
            const totalVendors = Number(item.stats.total_vendors ?? 0);
            return (
              <article key={item.key} className="flex flex-col rounded-2xl border border-border bg-surface p-5">
                <div className="flex items-start gap-3">
                  <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${accent.bg} ${accent.text}`}>
                    <PluginIcon pluginKey={item.key} />
                  </span>
                  <div className="min-w-0">
                    <h2 className="font-bold leading-tight">{item.name}</h2>
                    <p className="mt-1 text-xs leading-relaxed text-muted">{item.description}</p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {[item.group_label, item.lifecycle === "beta" ? "Beta" : "Active", "Standard"].map((tag) => (
                    <span key={tag} className="rounded-md bg-background px-2 py-0.5 text-[10px] font-bold text-primary">
                      {tag}
                    </span>
                  ))}
                </div>

                <p className="mt-4 text-[10px] font-bold uppercase tracking-wider text-muted">
                  Modules ({item.modules.length})
                </p>
                <ul className="mt-2 flex-1 space-y-1.5">
                  {item.modules.map((module) => (
                    <li key={module.key} className="flex items-center gap-2 text-xs">
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${module.enabled && item.enabled ? accent.dot : "bg-border"}`} />
                      <span className={module.enabled && item.enabled ? "" : "text-muted"}>{module.label}</span>
                      {module.badge && (
                        <span className="rounded bg-background px-1.5 py-0.5 text-[9px] font-bold uppercase text-muted">{module.badge}</span>
                      )}
                    </li>
                  ))}
                </ul>

                <div className="mt-4 border-t border-border pt-3">
                  <div className="flex items-end justify-between gap-2">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Vendors using</p>
                      <p className="text-sm font-bold">
                        {vendorsUsing.toLocaleString("en-IN")}
                        {totalVendors ? <span className="font-medium text-muted"> / {totalVendors.toLocaleString("en-IN")}</span> : null}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold">{item.enabled ? "Enabled" : "Disabled"}</span>
                      <Toggle
                        checked={item.enabled}
                        disabled={busy !== null}
                        label={`Enable ${item.name}`}
                        onChange={(next) => void toggleEnabled(item, next)}
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => openConfigure(item)}
                    className="mt-3 w-full cursor-pointer rounded-lg border border-border px-3 py-2 text-xs font-bold hover:bg-background disabled:opacity-50"
                  >
                    Configure
                  </button>
                </div>
              </article>
            );
          })
        )}
      </div>

      <p className="mt-4 text-xs text-muted">
        Fulfilment standard plugins (one per category) are managed under{" "}
        <Link href="/app/platform-admin/standard-plugins" className="font-semibold text-primary hover:underline">
          Standard Plugins
        </Link>
        .
      </p>

      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60" role="dialog" aria-modal="true" aria-label={`Configure ${selected.name}`}>
          <div className="h-full w-full max-w-xl overflow-y-auto bg-surface shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-surface px-5 py-4">
              <span
                className={`flex h-11 w-11 items-center justify-center rounded-xl ${(ACCENTS[selected.key] ?? ACCENTS.publicity).bg} ${(ACCENTS[selected.key] ?? ACCENTS.publicity).text}`}
              >
                <PluginIcon pluginKey={selected.key} />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="truncate font-extrabold">{selected.name}</h2>
                <p className="text-xs text-muted">Platform Admin · Configure</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedKey(null)}
                aria-label="Close configuration"
                className="cursor-pointer rounded-lg border border-border px-2.5 py-1.5 text-sm font-bold hover:bg-background"
              >
                ✕
              </button>
            </div>

            <div className="space-y-6 px-5 py-5">
              <section>
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted">Active stats</h3>
                <div className="mt-2 rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4">
                  <p className="flex items-center gap-2 text-sm font-semibold text-emerald-600">
                    <span className={`h-2 w-2 rounded-full ${selected.enabled ? "bg-emerald-500" : "bg-border"}`} />
                    {selected.lifecycle === "beta"
                      ? `Beta — ${Number(selected.stats.vendors_using ?? 0).toLocaleString("en-IN")} vendors using · feedback collection on`
                      : `Plugin is Live — ${Number(selected.stats.vendors_using ?? 0).toLocaleString("en-IN")} vendors actively using`}
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {(selected.stats.items ?? []).map((stat, index) => (
                      <div key={stat.key} className="rounded-lg bg-background px-3 py-2.5 text-center">
                        <p className={`text-lg font-extrabold ${STAT_COLORS[index % STAT_COLORS.length]}`}>{stat.value}</p>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted">{stat.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted">Standard plugin — what this means</h3>
                <div className="mt-2 rounded-xl border border-amber-500/25 bg-amber-500/5 p-4">
                  <p className="text-sm font-bold text-amber-600">⚡ Standard Plugin Guarantees</p>
                  <ul className="mt-2 space-y-1.5">
                    {selected.guarantees.map((line) => (
                      <li key={line} className="flex gap-2 text-xs leading-relaxed">
                        <span className="font-bold text-emerald-500">✓</span>
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>

              <section>
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted">Module permissions &amp; toggles</h3>
                <div className="mt-2 divide-y divide-border rounded-xl border border-border">
                  {draftModules.map((module) => (
                    <div key={module.key} className="flex items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                          {module.label}
                          {module.badge && (
                            <span className="rounded bg-violet-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-violet-500">
                              {module.badge}
                            </span>
                          )}
                        </p>
                        <p className="mt-0.5 text-xs text-muted">{module.description}</p>
                      </div>
                      <Toggle
                        checked={module.enabled}
                        disabled={busy !== null}
                        label={module.label}
                        onChange={(next) =>
                          setDraftModules((prev) =>
                            prev.map((item) => (item.key === module.key ? { ...item, enabled: next } : item)),
                          )
                        }
                      />
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted">Configuration</h3>
                <div className="mt-2 space-y-4 rounded-xl border border-border p-4">
                  {(CONFIG_FIELDS[selected.key] ?? []).map((field) => {
                    const value = draftConfig[field.key];
                    if (field.kind === "toggle") {
                      return (
                        <div key={field.key} className="flex items-center gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold">{field.label}</p>
                            {field.hint && <p className="mt-0.5 text-xs text-muted">{field.hint}</p>}
                          </div>
                          <Toggle
                            checked={Boolean(value)}
                            disabled={busy !== null}
                            label={field.label}
                            onChange={(next) => setDraftConfig((prev) => ({ ...prev, [field.key]: next }))}
                          />
                        </div>
                      );
                    }
                    return (
                      <label key={field.key} className="block">
                        <span className="text-sm font-semibold">{field.label}</span>
                        {field.kind === "select" ? (
                          <select
                            value={String(value ?? field.options[0])}
                            disabled={busy !== null}
                            onChange={(event) => setDraftConfig((prev) => ({ ...prev, [field.key]: event.target.value }))}
                            className="mt-1.5 w-full cursor-pointer rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary disabled:opacity-50"
                          >
                            {field.options.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type={field.kind === "number" ? "number" : "text"}
                            value={String(value ?? "")}
                            placeholder={field.kind === "text" ? field.placeholder : undefined}
                            disabled={busy !== null}
                            onChange={(event) =>
                              setDraftConfig((prev) => ({
                                ...prev,
                                [field.key]: field.kind === "number" ? Number(event.target.value) : event.target.value,
                              }))
                            }
                            className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary disabled:opacity-50"
                          />
                        )}
                        {field.hint && <span className="mt-1 block text-xs text-muted">{field.hint}</span>}
                      </label>
                    );
                  })}
                </div>
              </section>
            </div>

            <div className="sticky bottom-0 flex gap-2 border-t border-border bg-surface px-5 py-4">
              <button
                type="button"
                disabled={busy !== null || !selected.enabled}
                onClick={() => void disableSelected()}
                className="cursor-pointer rounded-lg border border-error/50 px-4 py-2.5 text-sm font-bold text-error hover:bg-error/5 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Disable Plugin
              </button>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void saveConfiguration()}
                className="flex-1 cursor-pointer rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
              >
                {busy === "save-config" ? "Saving…" : "Save Configuration"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
