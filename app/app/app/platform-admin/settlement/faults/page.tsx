"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { ApiError, platformAdminApi, type SettlementFaults } from "@/lib/api";
import { inr } from "../_format";

export default function SettlementFaultsPage() {
  const { ensureAccessToken } = useAuth();
  const [data, setData] = useState<SettlementFaults | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void platformAdminApi
      .settlementFaults(ensureAccessToken)
      .then(setData)
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.detail : "Could not load platform faults."),
      );
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
        <p className="text-sm text-muted">Loading platform faults…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-extrabold tracking-tight">Platform Fault Log</h1>
      <p className="mt-1 text-sm text-muted">Gateway and app faults absorbed by the platform.</p>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-2xl font-bold text-red-600">{data.kpis.faults_today}</p>
          <p className="mt-1 text-xs text-muted">Platform Faults Today</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-2xl font-bold text-amber-600">{inr(data.kpis.platform_absorbed)}</p>
          <p className="mt-1 text-xs text-muted">Platform Absorbed</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-2xl font-bold text-emerald-600">{data.kpis.auto_resolved_pct}%</p>
          <p className="mt-1 text-xs text-muted">Auto-resolved</p>
        </div>
      </div>

      <div className="mt-8 overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="px-4 py-3">Order</th>
              <th className="px-4 py-3">Fault Type</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Refund</th>
              <th className="px-4 py-3">Resolved In</th>
              <th className="px-4 py-3">Vendor Impacted</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((row) => (
              <tr key={row.id} className="border-t border-border">
                <td className="px-4 py-3 font-mono">{row.order_ref}</td>
                <td className="px-4 py-3">{row.fault_type}</td>
                <td className="px-4 py-3">{row.customer_name}</td>
                <td className="px-4 py-3 font-mono text-red-600">{inr(row.refund_amount)}</td>
                <td className="px-4 py-3 font-mono text-emerald-600">{row.resolved_in}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-600">
                    {row.vendor_impact === "not_touched" ? "Not touched" : "Full settled"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
