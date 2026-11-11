"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { ApiError, platformAdminApi, type SettlementLedger } from "@/lib/api";
import { inr, ledgerStatusLabel } from "../_format";

export default function SettlementLedgerPage() {
  const { ensureAccessToken } = useAuth();
  const [vendor, setVendor] = useState("Idli Dosa Co.");
  const [data, setData] = useState<SettlementLedger | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const next = await platformAdminApi.settlementLedger(ensureAccessToken, vendor);
    setData(next);
  }, [ensureAccessToken, vendor]);

  useEffect(() => {
    void load().catch((err: unknown) =>
      setError(err instanceof ApiError ? err.detail : "Could not load vendor ledger."),
    );
  }, [load]);

  if (error && !data) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <p className="text-sm text-error">{error}</p>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <p className="text-sm text-muted">Loading vendor ledger…</p>
      </main>
    );
  }

  const s = data.summary;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Vendor Settlement Ledger</h1>
          <p className="mt-1 text-sm text-muted">Per-order gross, deductions, net, and UTR.</p>
        </div>
        <label className="text-xs font-semibold uppercase text-muted">
          Vendor
          <select
            className="mt-1 block rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
            value={data.vendor_name}
            onChange={(e) => setVendor(e.target.value)}
          >
            {(data.vendors.length ? data.vendors : [data.vendor_name]).map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        <Summary label="Gross Orders" value={inr(s.gross_orders)} />
        <Summary label="Platform Commission" value={inr(s.platform_commission)} tone="violet" />
        <Summary label="GST on Comm" value={inr(s.gst_on_commission)} />
        <Summary label="Gateway Fee" value={inr(s.gateway_fee)} />
        <Summary label="TDS (1%)" value={inr(s.tds)} />
        <Summary label="Refund Adjustments" value={inr(s.refund_adjustments)} tone="red" />
        <Summary label="Net Settled" value={inr(s.net_settled)} tone="green" />
      </div>

      <div className="mt-8 overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="px-4 py-3">Order</th>
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3">Items</th>
              <th className="px-4 py-3">Gross</th>
              <th className="px-4 py-3">Deductions</th>
              <th className="px-4 py-3">Net</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">UTR</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((line) => (
              <tr key={line.id} className="border-t border-border">
                <td className="px-4 py-3 font-mono">{line.order_ref}</td>
                <td className="px-4 py-3">{line.order_time}</td>
                <td className="px-4 py-3">{line.items}</td>
                <td className="px-4 py-3 font-mono">{inr(line.gross)}</td>
                <td className="px-4 py-3 font-mono">{inr(line.deductions)}</td>
                <td className="px-4 py-3 font-mono">{line.net_label}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      line.status === "settled"
                        ? "bg-emerald-500/15 text-emerald-600"
                        : "bg-red-500/15 text-red-600"
                    }`}
                  >
                    {ledgerStatusLabel(line.status)}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-muted">{line.utr ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

function Summary({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "violet" | "red" | "green";
}) {
  const toneClass =
    tone === "violet"
      ? "text-violet-600"
      : tone === "red"
        ? "text-red-600"
        : tone === "green"
          ? "text-emerald-600"
          : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted">{label}</p>
      <p className={`mt-1 font-mono text-base font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}
