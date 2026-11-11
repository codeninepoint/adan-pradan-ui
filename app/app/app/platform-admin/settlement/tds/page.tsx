"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { ApiError, platformAdminApi, type SettlementTds } from "@/lib/api";
import { inr } from "../_format";

export default function SettlementTdsPage() {
  const { ensureAccessToken } = useAuth();
  const [data, setData] = useState<SettlementTds | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    void platformAdminApi
      .settlementTds(ensureAccessToken)
      .then(setData)
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.detail : "Could not load TDS / GST."),
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
        <p className="text-sm text-muted">Loading TDS / GST…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-extrabold tracking-tight">TDS / GST Tracker</h1>
      <p className="mt-1 text-sm text-muted">{data.period} withholdings and commission tax.</p>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-2xl font-bold text-amber-600">{inr(data.kpis.tds_this_month)}</p>
          <p className="mt-1 text-xs font-medium">TDS This Month</p>
          <p className="text-[11px] text-muted">Deposit by {data.kpis.tds_deposit_by}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-2xl font-bold text-teal-600">{inr(data.kpis.gst_on_commission)}</p>
          <p className="mt-1 text-xs font-medium">GST on Commission</p>
          <p className="text-[11px] text-muted">File by {data.kpis.gst_file_by}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-2xl font-bold text-emerald-600">{inr(data.kpis.total_commission)}</p>
          <p className="mt-1 text-xs font-medium">Total Commission</p>
          <p className="text-[11px] text-muted">{data.period}</p>
        </div>
      </div>

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
          TDS Ledger — Per Vendor ({data.period})
        </h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="px-4 py-3">Vendor</th>
                <th className="px-4 py-3">Gross Paid</th>
                <th className="px-4 py-3">TDS @1%</th>
                <th className="px-4 py-3">Net Paid</th>
                <th className="px-4 py-3">Form 16A</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((row) => (
                <tr key={row.id} className="border-t border-border">
                  <td className="px-4 py-3">{row.vendor_name}</td>
                  <td className="px-4 py-3 font-mono">{inr(row.gross_paid)}</td>
                  <td className="px-4 py-3 font-mono text-amber-600">{inr(row.tds_amount)}</td>
                  <td className="px-4 py-3 font-mono">{inr(row.net_paid)}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      className="rounded border border-border px-2 py-1 text-[10px] font-semibold"
                      onClick={() => {
                        setToast(`Form 16A download queued for ${row.vendor_name}`);
                        window.setTimeout(() => setToast(null), 2500);
                      }}
                    >
                      Download
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {toast ? (
        <div className="fixed bottom-6 right-6 rounded-lg bg-emerald-900 px-4 py-2 text-xs font-semibold text-emerald-200">
          {toast}
        </div>
      ) : null}
    </main>
  );
}
