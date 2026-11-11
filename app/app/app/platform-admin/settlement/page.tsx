"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { ApiError, platformAdminApi, type SettlementDashboard } from "@/lib/api";
import { batchStatusLabel, inr } from "./_format";

type Period = "today" | "week" | "month";

export default function SettlementDashboardPage() {
  const { ensureAccessToken } = useAuth();
  const [period, setPeriod] = useState<Period>("today");
  const [data, setData] = useState<SettlementDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const next = await platformAdminApi.settlementDashboard(ensureAccessToken, period);
    setData(next);
  }, [ensureAccessToken, period]);

  useEffect(() => {
    setLoading(true);
    void load()
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.detail : "Could not load settlement dashboard."),
      )
      .finally(() => setLoading(false));
  }, [load]);

  if (error) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <p className="text-sm text-error">{error}</p>
      </main>
    );
  }

  if (loading || !data) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <p className="text-sm text-muted">Loading settlement…</p>
      </main>
    );
  }

  const kpis = data.kpis;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Settlement Dashboard</h1>
          <p className="mt-1 text-sm text-muted">
            {data.as_of} · {data.zone}
            {data.live ? (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-600">
                Live
              </span>
            ) : null}
          </p>
        </div>
        <div className="flex gap-1 rounded-lg border border-border bg-surface p-1">
          {(
            [
              ["today", "Today"],
              ["week", "This Week"],
              ["month", "This Month"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setPeriod(key)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                period === key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {period === "today" ? (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Kpi value={inr(Number(kpis.live_escrow))} label="Live Escrow Balance" sub={`Across ${kpis.escrow_vendors} vendors`} tone="teal" />
          <Kpi value={String(kpis.auto_settlements)} label="Auto-Settlements" sub={`${inr(Number(kpis.auto_settlements_amount))} transferred`} tone="green" />
          <Kpi value={String(kpis.in_return_window)} label="In Return Window" sub="Countdowns active" tone="amber" />
          <Kpi value={String(kpis.returns_under_review)} label="Returns Under Review" sub={`${kpis.returns_contested_by_vendor} contested by vendor`} tone="red" />
          <Kpi value={inr(Number(kpis.tds_accumulated))} label="TDS Accumulated" sub={`Deposit by ${kpis.tds_deposit_by}`} tone="violet" />
          <Kpi value={String(kpis.failed_imps)} label="Failed IMPS" sub="Retry pending" tone="red" />
        </div>
      ) : null}

      {period === "week" ? (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kpi value={inr(Number(kpis.week_settled))} label="Week Settled" tone="green" />
          <Kpi value={String(kpis.orders_processed)} label="Orders Processed" tone="teal" />
          <Kpi value={String(kpis.returns_this_week)} label="Returns This Week" tone="amber" />
          <Kpi value={`${kpis.return_rate_pct}%`} label="Return Rate" tone="violet" />
        </div>
      ) : null}

      {period === "month" ? (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kpi value={inr(Number(kpis.month_settled))} label="Month Settled" tone="green" />
          <Kpi value={inr(Number(kpis.platform_commission))} label="Platform Commission" tone="violet" />
          <Kpi value={inr(Number(kpis.tds_accumulated))} label="TDS Accumulated" tone="amber" />
          <Kpi value={inr(Number(kpis.gst_on_commission))} label="GST on Commission" tone="teal" />
        </div>
      ) : null}

      <section className="mt-8 rounded-xl border border-border bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Escrow Breakdown</h2>
          <p className="text-xs text-muted">
            Total held: <span className="font-mono text-foreground">{inr(data.escrow.total)}</span>
          </p>
        </div>
        <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-background">
          <div className="bg-blue-700" style={{ width: `${(data.escrow.settled_queue / data.escrow.total) * 100}%` }} />
          <div className="bg-teal-600" style={{ width: `${(data.escrow.in_window / data.escrow.total) * 100}%` }} />
          <div className="bg-red-700" style={{ width: `${(data.escrow.on_hold / data.escrow.total) * 100}%` }} />
          <div className="bg-slate-600" style={{ width: `${(data.escrow.platform_float / data.escrow.total) * 100}%` }} />
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted">
          <Legend color="bg-blue-700" label={`Settled queue ${inr(data.escrow.settled_queue)}`} />
          <Legend color="bg-teal-600" label={`In window ${inr(data.escrow.in_window)}`} />
          <Legend color="bg-red-700" label={`On hold ${inr(data.escrow.on_hold)}`} />
          <Legend color="bg-slate-600" label={`Platform float ${inr(data.escrow.platform_float)}`} />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
          Hourly Settlement Batches · IMPS transfers today
        </h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="px-4 py-3">Batch Time</th>
                <th className="px-4 py-3">Vendors</th>
                <th className="px-4 py-3">Orders</th>
                <th className="px-4 py-3">Gross</th>
                <th className="px-4 py-3">Deductions</th>
                <th className="px-4 py-3">Net Transferred</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.batches.map((batch) => (
                <tr key={batch.id} className="border-t border-border">
                  <td className="px-4 py-3 font-mono">{batch.batch_time}</td>
                  <td className="px-4 py-3">{batch.vendors ?? "—"}</td>
                  <td className="px-4 py-3">{batch.orders ?? "—"}</td>
                  <td className="px-4 py-3 font-mono">{inr(batch.gross)}</td>
                  <td className="px-4 py-3 font-mono">{inr(batch.deductions)}</td>
                  <td className="px-4 py-3 font-mono text-emerald-600">{inr(batch.net)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        batch.status === "done"
                          ? "bg-emerald-500/15 text-emerald-600"
                          : batch.status === "failed_retry"
                            ? "bg-red-500/15 text-red-600"
                            : "bg-amber-500/15 text-amber-600"
                      }`}
                    >
                      {batchStatusLabel(batch.status, batch.utr)}
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
  sub,
  tone,
}: {
  value: string;
  label: string;
  sub?: string;
  tone: "teal" | "green" | "amber" | "red" | "violet";
}) {
  const toneClass = {
    teal: "text-teal-600",
    green: "text-emerald-600",
    amber: "text-amber-600",
    red: "text-red-600",
    violet: "text-violet-600",
  }[tone];
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <p className={`text-xl font-bold ${toneClass}`}>{value}</p>
      <p className="mt-1 text-xs font-medium text-foreground">{label}</p>
      {sub ? <p className="text-[11px] text-muted">{sub}</p> : null}
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block h-2 w-2 rounded-sm ${color}`} />
      {label}
    </span>
  );
}
