"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { useVendorPortal } from "@/components/vendor/portal";
import { ApiError, marketplaceApi, VendorStandardPluginItem } from "@/lib/api";

const PLUGIN_CATEGORIES = [
  "SHIP_PHYSICAL",
  "DELIVER_DIGITAL",
  "LICENSE_SOFTWARE",
  "PROVISION_SOFTWARE",
  "PROVISION_CLOUD",
  "STREAM_LMS_COURSE",
  "DELIVER_MULTIMEDIA",
  "DISPATCH_SERVICE",
  "BOOK_APPOINTMENT",
];

const inputClass =
  "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary";
const buttonClass =
  "cursor-pointer rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50";
const ghostClass =
  "cursor-pointer rounded-lg border border-border px-3 py-1.5 text-xs font-semibold disabled:opacity-50";

function categoryLabel(category: string): string {
  return category
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

export default function VendorPlatformPluginsPage() {
  const { vendor } = useVendorPortal();
  const { ensureAccessToken } = useAuth();
  const [items, setItems] = useState<VendorStandardPluginItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  const load = useCallback(async () => {
    if (!vendor) return;
    const params: { q?: string; category?: string } = {};
    if (search.trim()) params.q = search.trim();
    if (categoryFilter) params.category = categoryFilter;
    const data = await marketplaceApi.vendorStandardPlugins(vendor.vendor_id, ensureAccessToken, params);
    setItems(data.items);
  }, [vendor, ensureAccessToken, search, categoryFilter]);

  useEffect(() => {
    void load().catch((err: unknown) => {
      setError(err instanceof ApiError ? err.detail : "Could not load platform plugins.");
    });
  }, [load]);

  const categories = useMemo(() => {
    const fromItems = items.map((item) => item.category).filter(Boolean);
    return [...new Set([...PLUGIN_CATEGORIES, ...fromItems])].sort();
  }, [items]);

  const activeCount = useMemo(
    () => items.filter((item) => item.activation_status === "active").length,
    [items],
  );

  async function run(key: string, action: () => Promise<void>) {
    setError(null);
    setMessage(null);
    setBusy(key);
    try {
      await action();
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Request failed.");
    } finally {
      setBusy(null);
    }
  }

  if (!vendor) return null;

  return (
    <div>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Platform Plugins</h1>
        <p className="mt-1 text-sm text-muted">
          Browse and activate platform-owned plugins for your fulfilment categories — no review required.
        </p>
      </div>

      <div className="mt-4 rounded-xl border border-success/20 bg-success/5 px-4 py-3 text-sm text-foreground">
        Platform standard plugins are maintained by Adan Pradan. Activate a plugin to use it when creating
        products in that category. Deactivate anytime if you switch to a custom plugin instead.
      </div>

      {message && <p className="mt-4 text-sm text-primary">{message}</p>}
      {error && <p className="mt-4 text-sm text-error">{error}</p>}

      <div className="mt-6 flex flex-wrap gap-3">
        <div className="min-w-[200px] flex-1">
          <label className="text-xs font-semibold text-muted">
            Search
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Name or description…"
              className={inputClass}
            />
          </label>
        </div>
        <div className="w-full sm:w-56">
          <label className="text-xs font-semibold text-muted">
            Category
            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              className={inputClass}
            >
              <option value="">All categories</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {categoryLabel(category)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-2xl font-bold">{items.length}</p>
          <p className="text-xs text-muted">Available plugins</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-2xl font-bold text-success">{activeCount}</p>
          <p className="text-xs text-muted">Activated by you</p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.length === 0 ? (
          <p className="col-span-full text-sm text-muted">No platform plugins match your filters.</p>
        ) : (
          items.map((item) => {
            const active = item.activation_status === "active";
            return (
              <div key={item.plugin_id} className="rounded-xl border border-border bg-surface p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-muted">
                      {categoryLabel(item.category)}
                    </p>
                    <p className="mt-1 font-semibold">{item.name}</p>
                    <p className="mt-0.5 font-mono text-[10px] text-muted">{item.slug}</p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                      active ? "bg-success/15 text-success" : "bg-background text-muted"
                    }`}
                  >
                    {active ? "Active" : "Inactive"}
                  </span>
                </div>
                <p className="mt-2 text-xs text-muted">{item.short_description || "No description."}</p>
                {item.version && <p className="mt-2 text-xs text-muted">v{item.version}</p>}
                {item.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {item.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-background px-2 py-0.5 text-[10px] font-semibold text-muted"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-xs text-muted">
                  <span>{item.vendor_count} vendor{item.vendor_count === 1 ? "" : "s"} using</span>
                  {active ? (
                    <button
                      type="button"
                      className={ghostClass}
                      disabled={busy !== null}
                      onClick={() =>
                        void run(`deactivate-${item.plugin_id}`, async () => {
                          await marketplaceApi.deactivateStandardPlugin(
                            vendor.vendor_id,
                            item.plugin_id,
                            ensureAccessToken,
                          );
                          setMessage(`Deactivated ${item.name}.`);
                        })
                      }
                    >
                      {busy === `deactivate-${item.plugin_id}` ? "Deactivating…" : "Deactivate"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className={buttonClass}
                      disabled={busy !== null}
                      onClick={() =>
                        void run(`activate-${item.plugin_id}`, async () => {
                          await marketplaceApi.activateStandardPlugin(
                            vendor.vendor_id,
                            item.plugin_id,
                            ensureAccessToken,
                          );
                          setMessage(`Activated ${item.name}.`);
                        })
                      }
                    >
                      {busy === `activate-${item.plugin_id}` ? "Activating…" : "Activate"}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
