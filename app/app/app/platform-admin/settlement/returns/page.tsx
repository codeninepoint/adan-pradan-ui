"use client";

import { FormEvent, type ReactNode, useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import {
  ApiError,
  platformAdminApi,
  type SettlementReturnCase,
  type SettlementReturnQueue,
} from "@/lib/api";
import { inr, reasonLabel } from "../_format";

export default function SettlementReturnsPage() {
  const { ensureAccessToken } = useAuth();
  const [data, setData] = useState<SettlementReturnQueue | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [chatCase, setChatCase] = useState<SettlementReturnCase | null>(null);
  const [partialCase, setPartialCase] = useState<SettlementReturnCase | null>(null);
  const [partialAmount, setPartialAmount] = useState("");
  const [partialReason, setPartialReason] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const next = await platformAdminApi.settlementReturns(ensureAccessToken);
    setData(next);
  }, [ensureAccessToken]);

  useEffect(() => {
    void load().catch((err: unknown) =>
      setError(err instanceof ApiError ? err.detail : "Could not load return queue."),
    );
  }, [load]);

  async function resolve(caseId: string, outcome: string, amount?: number, reason?: string) {
    setBusyId(caseId);
    setError(null);
    try {
      const result = await platformAdminApi.resolveSettlementReturn(
        caseId,
        { outcome, amount, reason },
        ensureAccessToken,
      );
      setMessage(result.message);
      setPartialCase(null);
      await load();
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.detail : "Could not resolve return.");
    } finally {
      setBusyId(null);
    }
  }

  function onPartial(event: FormEvent) {
    event.preventDefault();
    if (!partialCase) return;
    const amount = Number(partialAmount);
    void resolve(partialCase.id, "partial", amount, partialReason);
  }

  if (error && !data) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <p className="text-sm text-error">{error}</p>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <p className="text-sm text-muted">Loading return queue…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-extrabold tracking-tight">Return Review Queue</h1>
      <p className="mt-1 text-sm text-muted">{data.open_count} open contested case(s)</p>

      <div className="mt-4 rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm text-sky-800 dark:text-sky-200">
        ℹ {data.info}
      </div>

      {message ? (
        <p className="mt-3 rounded-lg bg-emerald-500/15 px-3 py-2 text-sm text-emerald-700">{message}</p>
      ) : null}
      {error ? <p className="mt-3 text-sm text-error">{error}</p> : null}

      <div className="mt-6 space-y-4">
        {data.items.map((item) => (
          <article
            key={item.id}
            className={`overflow-hidden rounded-xl border ${
              item.case_type === "contested" && item.status === "open"
                ? "border-red-500/40"
                : "border-border"
            } bg-surface`}
          >
            <header className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3 text-xs font-bold">
              <CaseBadge type={item.case_type} />
              {item.deadline_seconds && item.status === "open" ? (
                <span className="rounded bg-red-500/15 px-2 py-0.5 font-mono text-red-600">
                  {Math.floor(item.deadline_seconds / 60)}:
                  {String(item.deadline_seconds % 60).padStart(2, "0")} left
                </span>
              ) : null}
              <span className="ml-auto font-normal text-muted">
                Order {item.order_ref}
                {item.vendor_name ? ` · ${item.vendor_name}` : ""}
                {item.timeline && item.case_type !== "contested" ? ` · ${item.timeline}` : ""}
              </span>
            </header>

            {item.case_type === "contested" ? (
              <div className="grid gap-4 p-4 sm:grid-cols-[72px_1fr]">
                <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-background text-2xl">
                  🍽️
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted">
                    Customer Says
                  </p>
                  <p className="mt-1 text-sm">&ldquo;{item.customer_claim}&rdquo;</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-semibold text-red-600">
                      {reasonLabel(item.reason_code)}
                    </span>
                    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-600">
                      {inr(item.amount_at_stake)} at stake
                    </span>
                  </div>
                  <p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-muted">
                    Vendor Says
                  </p>
                  <p className="mt-1 text-sm text-muted">&ldquo;{item.vendor_claim}&rdquo;</p>
                  <p className="mt-2 text-xs text-muted">{item.timeline}</p>
                  {item.chat.length > 0 ? (
                    <button
                      type="button"
                      className="mt-2 text-xs font-semibold text-primary hover:underline"
                      onClick={() => setChatCase(item)}
                    >
                      View in-app chat history →
                    </button>
                  ) : null}
                </div>
              </div>
            ) : (
              <p className="px-4 py-3 text-sm text-muted">{item.summary}</p>
            )}

            {item.status === "open" && item.case_type === "contested" ? (
              <div className="flex flex-wrap gap-2 border-t border-border px-4 py-3">
                <button
                  type="button"
                  disabled={busyId === item.id}
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                  onClick={() => void resolve(item.id, "refund")}
                >
                  Refund Customer — Vendor Fault
                </button>
                <button
                  type="button"
                  disabled={busyId === item.id}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                  onClick={() => void resolve(item.id, "support_vendor")}
                >
                  Support Vendor — Reject Refund
                </button>
                <button
                  type="button"
                  disabled={busyId === item.id}
                  className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                  onClick={() => {
                    setPartialCase(item);
                    setPartialAmount(String(item.amount_at_stake));
                    setPartialReason("");
                  }}
                >
                  Partial Refund
                </button>
                <button
                  type="button"
                  className="ml-auto rounded-lg border border-border px-3 py-1.5 text-xs font-semibold"
                  onClick={() => setChatCase(item)}
                >
                  Chat Log
                </button>
              </div>
            ) : null}
          </article>
        ))}
      </div>

      {chatCase ? (
        <Modal title={`In-App Chat — Order ${chatCase.order_ref}`} onClose={() => setChatCase(null)}>
          <div className="flex max-h-80 flex-col gap-2 overflow-y-auto">
            {chatCase.chat.map((msg, index) => {
              if (msg.kind === "system" || msg.kind === "alert") {
                return (
                  <p
                    key={`${msg.kind}-${index}`}
                    className={`text-center text-[10px] ${
                      msg.kind === "alert" ? "text-red-600" : "text-muted"
                    }`}
                  >
                    {msg.kind === "alert" ? `⚠ ${msg.text}` : msg.text}
                  </p>
                );
              }
              const mine = msg.kind === "vendor";
              return (
                <div
                  key={`${msg.kind}-${index}`}
                  className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                    mine ? "ml-auto bg-background" : "bg-sky-500/10"
                  }`}
                >
                  <span
                    className={`mb-1 block text-[9px] font-bold uppercase ${
                      mine ? "text-emerald-600" : "text-sky-600"
                    }`}
                  >
                    {msg.kind}
                  </span>
                  {msg.text}
                </div>
              );
            })}
          </div>
        </Modal>
      ) : null}

      {partialCase ? (
        <Modal
          title={`Partial Refund — Order ${partialCase.order_ref}`}
          onClose={() => setPartialCase(null)}
        >
          <form className="space-y-3" onSubmit={onPartial}>
            <label className="block text-xs font-semibold uppercase text-muted">
              Refund Amount
              <input
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                type="number"
                min="1"
                step="0.01"
                value={partialAmount}
                onChange={(e) => setPartialAmount(e.target.value)}
                required
              />
            </label>
            <label className="block text-xs font-semibold uppercase text-muted">
              Reason (sent to both parties)
              <textarea
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                rows={3}
                value={partialReason}
                onChange={(e) => setPartialReason(e.target.value)}
                placeholder="e.g. One item missing, rest of order correct"
              />
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold"
                onClick={() => setPartialCase(null)}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busyId === partialCase.id}
                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
              >
                Process Partial Refund
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
    </main>
  );
}

function CaseBadge({ type }: { type: string }) {
  const map: Record<string, { label: string; className: string }> = {
    contested: {
      label: "🔴 CONTESTED — Vendor Rejected",
      className: "text-red-600",
    },
    vendor_accepted: {
      label: "✅ VENDOR ACCEPTED — Auto-resolved",
      className: "text-emerald-600",
    },
    platform_fault: {
      label: "⚡ PLATFORM FAULT — Auto-refunded",
      className: "text-sky-600",
    },
    timed_out: {
      label: "🟡 TIMED OUT — Auto-accepted",
      className: "text-amber-600",
    },
  };
  const item = map[type] ?? { label: type, className: "text-muted" };
  return <span className={item.className}>{item.label}</span>;
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-bold">{title}</h2>
          <button type="button" className="text-muted hover:text-foreground" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
