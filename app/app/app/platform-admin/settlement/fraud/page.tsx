"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import {
  ApiError,
  platformAdminApi,
  type SettlementFraud,
} from "@/lib/api";

export default function SettlementFraudPage() {
  const { ensureAccessToken } = useAuth();
  const [data, setData] = useState<SettlementFraud | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const next = await platformAdminApi.settlementFraud(ensureAccessToken);
    setData(next);
  }, [ensureAccessToken]);

  useEffect(() => {
    void load().catch((err: unknown) =>
      setError(err instanceof ApiError ? err.detail : "Could not load fraud signals."),
    );
  }, [load]);

  async function act(signalId: string, action: string) {
    setBusyId(signalId);
    setError(null);
    try {
      const result = await platformAdminApi.settlementFraudAction(
        signalId,
        action,
        ensureAccessToken,
      );
      setMessage(result.message);
      await load();
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.detail : "Could not update fraud signal.");
    } finally {
      setBusyId(null);
    }
  }

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
        <p className="text-sm text-muted">Loading fraud signals…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-extrabold tracking-tight">Fraud Signals</h1>
      <p className="mt-1 text-sm text-muted">Abnormal return and complaint patterns.</p>

      <div className="mt-4 rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm text-sky-800 dark:text-sky-200">
        ℹ {data.info}
      </div>

      {message ? (
        <p className="mt-3 rounded-lg bg-emerald-500/15 px-3 py-2 text-sm text-emerald-700">{message}</p>
      ) : null}
      {error ? <p className="mt-3 text-sm text-error">{error}</p> : null}

      <div className="mt-6 overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="px-4 py-3">Party</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Signal</th>
              <th className="px-4 py-3">Returns</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((row) => (
              <tr key={row.id} className="border-t border-border">
                <td className="px-4 py-3">{row.party_name}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      row.party_type === "customer"
                        ? "bg-red-500/15 text-red-600"
                        : "bg-amber-500/15 text-amber-600"
                    }`}
                  >
                    {row.party_type === "customer" ? "Customer" : "Vendor"}
                  </span>
                </td>
                <td className="px-4 py-3">{row.signal}</td>
                <td className="px-4 py-3 font-mono text-red-600">{row.returns_label}</td>
                <td className="px-4 py-3 capitalize text-muted">{row.status}</td>
                <td className="px-4 py-3">
                  {row.status === "open" ? (
                    <button
                      type="button"
                      disabled={busyId === row.id}
                      className={`rounded px-2 py-1 text-[10px] font-semibold disabled:opacity-50 ${
                        row.party_type === "customer"
                          ? "bg-amber-500 text-white"
                          : "border border-border"
                      }`}
                      onClick={() =>
                        void act(row.id, row.party_type === "customer" ? "flag" : "warn")
                      }
                    >
                      {row.action_label}
                    </button>
                  ) : (
                    <span className="text-xs text-muted">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
