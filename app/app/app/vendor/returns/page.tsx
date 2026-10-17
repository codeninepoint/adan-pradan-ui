"use client";

import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { useVendorPortal } from "@/components/vendor/portal";
import { ApiError, marketplaceApi, type VendorReturnItem } from "@/lib/api";
import { formatMoney } from "@/lib/money";

const buttonClass =
  "cursor-pointer rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50";
const successClass =
  "cursor-pointer rounded-lg border border-success/40 bg-success/10 px-3 py-1.5 text-xs font-bold text-success disabled:cursor-not-allowed disabled:opacity-50";
const ghostClass =
  "cursor-pointer rounded-lg border border-border px-3 py-1.5 text-xs font-semibold disabled:opacity-50";
const dangerClass =
  "cursor-pointer rounded-lg border border-error/40 bg-error/10 px-3 py-1.5 text-xs font-bold text-error disabled:cursor-not-allowed disabled:opacity-50";
const inputClass =
  "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary";

const METHOD_LABELS: Record<string, string> = {
  original: "Original payment",
  wallet: "Wallet credit",
  upi: "UPI",
};

const STATUS_LABELS: Record<string, string> = {
  requested: "Pending review",
  approved: "Approved · refund pending",
  rejected: "Rejected",
  refunded: "Refunded",
};

export default function VendorReturnsPage() {
  const { vendor } = useVendorPortal();
  const { ensureAccessToken } = useAuth();
  const [rows, setRows] = useState<VendorReturnItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState<VendorReturnItem | null>(null);

  const load = useCallback(async () => {
    if (!vendor) return;
    const data = await marketplaceApi.vendorReturns(vendor.vendor_id, ensureAccessToken);
    setRows(data.returns);
  }, [vendor, ensureAccessToken]);

  useEffect(() => {
    void load().catch((err: unknown) => {
      setError(err instanceof ApiError ? err.detail : "Could not load returns.");
    });
  }, [load]);

  const pending = useMemo(() => rows.filter((r) => r.status === "requested"), [rows]);
  const approved = useMemo(() => rows.filter((r) => r.status === "approved"), [rows]);
  const rejected = useMemo(() => rows.filter((r) => r.status === "rejected"), [rows]);
  const refundedThisMonth = useMemo(() => {
    const now = new Date();
    return rows.filter((r) => {
      if (r.status !== "refunded" || !r.refunded_at) return false;
      const at = new Date(r.refunded_at);
      return at.getFullYear() === now.getFullYear() && at.getMonth() === now.getMonth();
    });
  }, [rows]);

  const openRequests = useMemo(
    () => rows.filter((r) => r.status === "requested" || r.status === "approved"),
    [rows],
  );

  async function run(key: string, action: () => Promise<void>) {
    setBusy(key);
    setError(null);
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
      <h1 className="text-2xl font-bold tracking-tight">Returns & Refunds</h1>
      <p className="mt-1 text-sm text-muted">
        Review return requests, approve or reject, and confirm refund issuance.
      </p>

      {error && <p className="mt-4 text-sm text-error">{error}</p>}

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Pending review" value={pending.length} accent="text-amber-600 dark:text-amber-400" />
        <StatCard
          label="Approved · refund pending"
          value={approved.length}
          accent="text-sky-600 dark:text-sky-400"
        />
        <StatCard
          label="Refunded (this month)"
          value={refundedThisMonth.length}
          accent="text-success"
        />
        <StatCard label="Rejected" value={rejected.length} accent="text-error" />
      </div>

      {pending.length > 0 && (
        <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm">
          You have <strong>{pending.length} return request{pending.length === 1 ? "" : "s"} awaiting
          review</strong>. Unreviewed requests auto-escalate to Platform Admin after 72 hours.
        </div>
      )}

      <div className="mt-8 overflow-x-auto rounded-xl border border-border bg-surface">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-bold">Return requests</h2>
        </div>
        {openRequests.length === 0 ? (
          <p className="px-4 py-8 text-sm text-muted">No open return requests.</p>
        ) : (
          <table className="w-full min-w-[56rem] text-left text-sm">
            <thead className="text-xs font-semibold uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Return ID</th>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Product(s)</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Requested</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {openRequests.map((row) => (
                <tr key={row.return_id} className="border-t border-border">
                  <td className="px-4 py-3 font-mono text-xs font-semibold">
                    #{row.return_id.slice(0, 8)}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">#{row.order_id.slice(0, 8)}</td>
                  <td className="px-4 py-3">{row.customer_name}</td>
                  <td className="px-4 py-3 text-muted">
                    {row.product_name}
                    {row.quantity > 1 ? ` ×${row.quantity}` : ""}
                  </td>
                  <td className="px-4 py-3 text-muted">{row.reason}</td>
                  <td className="px-4 py-3 text-muted">{formatDate(row.created_at)}</td>
                  <td className="px-4 py-3 font-semibold">
                    {formatMoney(row.refund_amount ?? row.amount, row.refund_currency || row.currency)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="px-4 py-3">
                    {row.status === "requested" && (
                      <button
                        type="button"
                        disabled={busy !== null}
                        className={buttonClass}
                        onClick={() => setReviewing(row)}
                      >
                        Review
                      </button>
                    )}
                    {row.status === "approved" && (
                      <button
                        type="button"
                        disabled={busy !== null}
                        className={successClass}
                        onClick={() => {
                          if (
                            !confirm(
                              `Issue refund of ${formatMoney(
                                row.refund_amount ?? row.amount,
                                row.refund_currency || row.currency,
                              )} to ${row.customer_name}?`,
                            )
                          ) {
                            return;
                          }
                          void run(`refund-${row.return_id}`, async () => {
                            await marketplaceApi.issueReturnRefund(
                              vendor.vendor_id,
                              row.return_id,
                              ensureAccessToken,
                            );
                          });
                        }}
                      >
                        {busy === `refund-${row.return_id}` ? "Issuing…" : "Issue refund"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-8 overflow-x-auto rounded-xl border border-border bg-surface">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-bold">Refund history (this month)</h2>
        </div>
        {refundedThisMonth.length === 0 ? (
          <p className="px-4 py-8 text-sm text-muted">No refunds issued this month.</p>
        ) : (
          <table className="w-full min-w-[48rem] text-left text-sm">
            <thead className="text-xs font-semibold uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Refund ID</th>
                <th className="px-4 py-3">Return ID</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3">Issued on</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {refundedThisMonth.map((row) => (
                <tr key={row.return_id} className="border-t border-border">
                  <td className="px-4 py-3 font-mono text-xs font-semibold">
                    #REF-{row.return_id.slice(0, 6).toUpperCase()}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">#{row.return_id.slice(0, 8)}</td>
                  <td className="px-4 py-3">{row.customer_name}</td>
                  <td className="px-4 py-3 font-semibold">
                    {formatMoney(row.refund_amount ?? row.amount, row.refund_currency || row.currency)}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {METHOD_LABELS[row.refund_method || ""] || row.refund_method || "—"}
                  </td>
                  <td className="px-4 py-3 text-muted">{formatDate(row.refunded_at)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status="refunded" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {reviewing && (
        <ReviewModal
          item={reviewing}
          busy={busy === `decide-${reviewing.return_id}`}
          onClose={() => setReviewing(null)}
          onDecide={(decision, payload) => {
            void run(`decide-${reviewing.return_id}`, async () => {
              await marketplaceApi.decideReturn(
                vendor.vendor_id,
                reviewing.return_id,
                { decision, ...payload },
                ensureAccessToken,
              );
              setReviewing(null);
            });
          }}
        />
      )}
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className={`text-2xl font-bold ${accent}`}>{value}</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    requested: "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300",
    approved: "border-sky-500/30 bg-sky-500/10 text-sky-800 dark:text-sky-300",
    rejected: "border-error/30 bg-error/10 text-error",
    refunded: "border-success/30 bg-success/10 text-success",
  };
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
        styles[status] ?? "border-border text-muted"
      }`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

function formatDate(value: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-label={title}
        className="my-8 w-full max-w-md rounded-xl border border-border bg-surface p-5"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-bold">{title}</h2>
          <button type="button" className={ghostClass} onClick={onClose}>
            Close
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

function ReviewModal({
  item,
  busy,
  onClose,
  onDecide,
}: {
  item: VendorReturnItem;
  busy: boolean;
  onClose: () => void;
  onDecide: (
    decision: "approved" | "rejected",
    payload: { refund_amount?: number; refund_method?: string; vendor_notes?: string },
  ) => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const [amount, setAmount] = useState(String(item.amount));
  const [method, setMethod] = useState("original");
  const [notes, setNotes] = useState("");
  const maxAmount = item.amount;

  function onApprove(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0 || value > maxAmount) {
      setFormError(`Enter a refund amount between 0.01 and ${maxAmount}.`);
      return;
    }
    setFormError(null);
    onDecide("approved", {
      refund_amount: value,
      refund_method: method,
      vendor_notes: notes,
    });
  }

  return (
    <Dialog title={`Review Return #${item.return_id.slice(0, 8)}`} onClose={onClose}>
      <p className="mb-3 text-sm text-muted">
        Order #{item.order_id.slice(0, 8)} · {item.customer_name}
      </p>
      <div className="mb-4 grid grid-cols-2 gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs">
        <span className="text-muted">Products</span>
        <span>
          {item.product_name}
          {item.quantity > 1 ? ` ×${item.quantity}` : ""}
        </span>
        <span className="text-muted">Reason</span>
        <span>{item.reason}</span>
        <span className="text-muted">Requested</span>
        <span>{formatDate(item.created_at)}</span>
        <span className="text-muted">Order amount</span>
        <strong>{formatMoney(item.amount, item.currency)}</strong>
      </div>
      <form onSubmit={onApprove} className="space-y-3">
        {formError && <p className="text-sm text-error">{formError}</p>}
        <label className="block text-xs font-semibold text-muted">
          Refund amount
          <input
            type="number"
            min="0.01"
            max={maxAmount}
            step="0.01"
            required
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className={inputClass}
          />
          <span className="mt-1 block font-normal">
            max {formatMoney(maxAmount, item.currency)}
          </span>
        </label>
        <label className="block text-xs font-semibold text-muted">
          Refund method
          <select
            required
            value={method}
            onChange={(event) => setMethod(event.target.value)}
            className={inputClass}
          >
            <option value="original">Original payment method</option>
            <option value="wallet">Wallet credit (instant)</option>
            <option value="upi">UPI</option>
          </select>
        </label>
        <label className="block text-xs font-semibold text-muted">
          Your notes (optional)
          <textarea
            rows={3}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="E.g. confirmed wrong item sent, approved full refund..."
            className={inputClass}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={busy} className={successClass}>
            {busy ? "Saving…" : "Approve"}
          </button>
          <button
            type="button"
            disabled={busy}
            className={dangerClass}
            onClick={() => {
              if (!confirm(`Reject return request from ${item.customer_name}? This cannot be undone.`)) {
                return;
              }
              onDecide("rejected", { vendor_notes: notes });
            }}
          >
            Reject
          </button>
        </div>
      </form>
    </Dialog>
  );
}
