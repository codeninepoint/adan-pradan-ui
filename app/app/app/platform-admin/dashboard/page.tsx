"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { ApiError, platformAdminApi } from "@/lib/api";

type Dashboard = {
  tenant_count: number;
  active_tenants: number;
  vendor_count: number;
  verified_vendors: number;
  user_count: number;
  pending_plugin_reviews: number;
  pending_product_reviews: number;
  revenue_mtd: number;
  recent_events: {
    event_action?: string;
    actor_email?: string | null;
    created_at?: string;
  }[];
};

export default function DashboardPage() {
  const { ensureAccessToken } = useAuth();
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void platformAdminApi
      .dashboard(ensureAccessToken)
      .then(setData)
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.detail : "Could not load dashboard.");
      });
  }, [ensureAccessToken]);

  if (error) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <p className="text-sm text-error">{error}</p>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <p className="text-sm text-muted">Loading dashboard…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-extrabold tracking-tight">Dashboard</h1>
      <p className="mt-1 text-sm text-muted">Platform-wide KPIs and recent activity.</p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Tenants", data.tenant_count],
          ["Active tenants", data.active_tenants],
          ["Vendors", data.vendor_count],
          ["Verified vendors", data.verified_vendors],
          ["Users", data.user_count],
          ["Plugin reviews", data.pending_plugin_reviews],
          ["Product reviews", data.pending_product_reviews],
          ["Revenue MTD", data.revenue_mtd.toLocaleString()],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-xl border border-border bg-surface p-3">
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs text-muted">{label}</p>
          </div>
        ))}
      </div>

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Recent events</h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-surface text-xs uppercase text-muted">
                <th className="px-3 py-2">Action</th>
                <th className="px-3 py-2">Actor</th>
                <th className="px-3 py-2">When</th>
              </tr>
            </thead>
            <tbody>
              {data.recent_events.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-3 py-6 text-muted">
                    No recent events.
                  </td>
                </tr>
              )}
              {data.recent_events.map((event, idx) => (
                <tr key={`${event.event_action}-${idx}`} className="border-b border-border/60">
                  <td className="px-3 py-2 font-medium">{event.event_action ?? "—"}</td>
                  <td className="px-3 py-2 text-muted">{event.actor_email ?? "—"}</td>
                  <td className="px-3 py-2 text-muted">{event.created_at ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
