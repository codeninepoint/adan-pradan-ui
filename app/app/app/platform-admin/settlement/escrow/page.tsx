"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { ApiError, platformAdminApi, type SettlementEscrow } from "@/lib/api";
import { inr } from "../_format";

export default function SettlementEscrowPage() {
  const { ensureAccessToken } = useAuth();
  const [data, setData] = useState<SettlementEscrow | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void platformAdminApi
      .settlementEscrow(ensureAccessToken)
      .then(setData)
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.detail : "Could not load escrow."),
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
        <p className="text-sm text-muted">Loading escrow…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-extrabold tracking-tight">Escrow Monitor</h1>
      <p className="mt-1 text-sm text-muted">Live return-window holds and release queue.</p>

      <div className="mt-4 rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm text-sky-800 dark:text-sky-200">
        ℹ {data.info}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi value={inr(data.kpis.total_escrow)} label="Total Escrow" tone="teal" />
        <Kpi value={inr(data.kpis.queued_for_release)} label="Queued for Release" tone="green" />
        <Kpi value={inr(data.kpis.in_return_window)} label="In Return Window" tone="amber" />
        <Kpi value={inr(data.kpis.on_hold)} label="On Hold (Returns)" tone="red" />
      </div>

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
          Orders in Return Window — Live Countdown
        </h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Vendor</th>
                <th className="px-4 py-3">Delivered</th>
                <th className="px-4 py-3">Window Closes</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((row) => (
                <tr key={row.id} className="border-t border-border">
                  <td className="px-4 py-3 font-mono">{row.order_ref}</td>
                  <td className="px-4 py-3">{row.vendor_name}</td>
                  <td className="px-4 py-3 font-mono">{row.delivered_at}</td>
                  <td className="px-4 py-3 font-mono">
                    {row.window_closes_at}
                    {row.minutes_left != null ? (
                      <span
                        className={`ml-1 text-[10px] ${
                          row.minutes_left <= 5 ? "text-red-600" : "text-emerald-600"
                        }`}
                      >
                        ({row.minutes_left} min)
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 font-mono">{inr(row.amount)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        row.status === "released"
                          ? "bg-emerald-500/15 text-emerald-600"
                          : "bg-amber-500/15 text-amber-600"
                      }`}
                    >
                      {row.status === "released" ? "Released → IMPS" : "Window Open"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function Kpi({
  value,
  label,
  tone,
}: {
  value: string;
  label: string;
  tone: "teal" | "green" | "amber" | "red";
}) {
  const toneClass = {
    teal: "text-teal-600",
    green: "text-emerald-600",
    amber: "text-amber-600",
    red: "text-red-600",
  }[tone];
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <p className={`text-xl font-bold ${toneClass}`}>{value}</p>
      <p className="mt-1 text-xs text-muted">{label}</p>
    </div>
  );
}
