"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { ApiError, platformAdminApi } from "@/lib/api";

const TABS = ["users", "vendors", "plugins", "revenue"] as const;
type Tab = (typeof TABS)[number];

const TAB_LABELS: Record<Tab, string> = {
  users: "Users",
  vendors: "Vendors",
  plugins: "Plugins",
  revenue: "Revenue",
};

function BarRow({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3 py-1">
      <span className="w-32 shrink-0 text-sm text-muted">{label}</span>
      <div className="h-2 flex-1 rounded bg-background">
        <div className="h-2 rounded bg-primary" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-12 text-right text-sm font-medium">{value}</span>
    </div>
  );
}

function renderAnalytics(tab: Tab, data: Record<string, unknown>) {
  if (tab === "users") {
    const total = Number(data.total_users ?? 0);
    const active = Number(data.active_users ?? 0);
    return (
      <div className="space-y-2">
        <BarRow label="Total users" value={total} max={total} />
        <BarRow label="Active users" value={active} max={total} />
      </div>
    );
  }

  if (tab === "vendors") {
    const byStatus = (data.by_status ?? {}) as Record<string, number>;
    const entries = Object.entries(byStatus);
    const max = Math.max(...entries.map(([, v]) => v), 1);
    return (
      <div className="space-y-2">
        {entries.length === 0 && <p className="text-sm text-muted">No vendor data.</p>}
        {entries.map(([status, count]) => (
          <BarRow key={status} label={status} value={count} max={max} />
        ))}
      </div>
    );
  }

  if (tab === "plugins") {
    const byStatus = (data.versions_by_status ?? {}) as Record<string, number>;
    const entries = Object.entries(byStatus);
    const max = Math.max(...entries.map(([, v]) => v), 1);
    const total = Number(data.total_plugins ?? 0);
    return (
      <div className="space-y-4">
        <p className="text-sm">
          Total plugins: <span className="font-semibold">{total}</span>
        </p>
        <div className="space-y-2">
          {entries.length === 0 && <p className="text-sm text-muted">No version data.</p>}
          {entries.map(([status, count]) => (
            <BarRow key={status} label={status} value={count} max={max} />
          ))}
        </div>
      </div>
    );
  }

  const revenue = Number(data.revenue_mtd ?? 0);
  const orders = Number(data.orders_mtd ?? 0);
  const max = Math.max(revenue, orders, 1);
  return (
    <div className="space-y-2">
      <BarRow label="Revenue MTD" value={revenue} max={max} />
      <BarRow label="Orders MTD" value={orders} max={max} />
    </div>
  );
}

export default function AnalyticsPage() {
  const { ensureAccessToken } = useAuth();
  const [tab, setTab] = useState<Tab>("users");
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const result = await platformAdminApi.analytics(ensureAccessToken, tab);
    setData(result);
  }, [ensureAccessToken, tab]);

  useEffect(() => {
    void load().catch((err: unknown) => {
      setError(err instanceof ApiError ? err.detail : "Could not load analytics.");
    });
  }, [load]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-extrabold tracking-tight">Analytics</h1>
      <p className="mt-1 text-sm text-muted">Platform metrics by domain.</p>

      <div className="mt-6 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              tab === t ? "bg-primary text-primary-foreground" : "bg-surface text-muted"
            }`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {error && <p className="mt-4 text-sm text-error">{error}</p>}

      <section className="mt-6 rounded-xl border border-border bg-surface p-5">
        {!data ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : (
          <>
            <h2 className="mb-4 text-sm font-semibold">{TAB_LABELS[tab]}</h2>
            {renderAnalytics(tab, data)}
            <details className="mt-6">
              <summary className="cursor-pointer text-xs text-muted">Raw response</summary>
              <pre className="mt-2 overflow-x-auto rounded bg-background p-3 text-xs">
                {JSON.stringify(data, null, 2)}
              </pre>
            </details>
          </>
        )}
      </section>
    </main>
  );
}
