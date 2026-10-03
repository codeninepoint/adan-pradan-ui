"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { useVendorPortal } from "@/components/vendor/portal";
import { ApiError, vendorApi } from "@/lib/api";

const TOPICS = ["Order issue", "Payment / settlement", "Product listing", "Account / KYC", "Other"];

type RequestRow = {
  request_id: string;
  subject: string;
  message: string;
  status: string;
  created_at: string;
};

const inputClass =
  "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary";

export default function VendorSupportPage() {
  const { vendor } = useVendorPortal();
  const { ensureAccessToken } = useAuth();
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!vendor) return;
    const data = await vendorApi.supportRequests(vendor.vendor_id, ensureAccessToken);
    setRows(data.requests);
  }, [vendor, ensureAccessToken]);

  useEffect(() => {
    void load().catch((err: unknown) => {
      setError(err instanceof ApiError ? err.detail : "Could not load support requests.");
    });
  }, [load]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!vendor) return;
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    try {
      await vendorApi.createSupportRequest(
        vendor.vendor_id,
        { subject: String(data.get("subject") ?? ""), message: String(data.get("message") ?? "") },
        ensureAccessToken,
      );
      event.currentTarget.reset();
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Could not send the request.");
    } finally {
      setBusy(false);
    }
  }

  if (!vendor) return null;

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold tracking-tight">Support</h1>
      <p className="mt-1 text-sm text-muted">Requests you send stay open. There is no ticket workflow beyond this list.</p>
      {error && <p className="mt-4 text-sm text-error">{error}</p>}
      <form onSubmit={(event) => void onSubmit(event)} className="mt-6 space-y-3 rounded-xl border border-border bg-surface p-4">
        <label className="block text-xs font-semibold text-muted">
          Topic
          <select name="subject" required className={inputClass} defaultValue={TOPICS[0]}>
            {TOPICS.map((topic) => (
              <option key={topic}>{topic}</option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-semibold text-muted">
          Message
          <textarea name="message" required rows={4} className={inputClass} />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50"
        >
          {busy ? "Sending…" : "Send message"}
        </button>
      </form>
      <ul className="mt-6 space-y-3">
        {rows.length === 0 && <li className="text-sm text-muted">No requests yet.</li>}
        {rows.map((row) => (
          <li key={row.request_id} className="rounded-xl border border-border bg-surface p-4 text-sm">
            <div className="flex items-start justify-between gap-3">
              <p className="font-semibold">{row.subject}</p>
              <span className="text-xs font-semibold capitalize text-muted">{row.status}</span>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-muted">{row.message}</p>
            <p className="mt-2 text-xs text-muted">{row.created_at.slice(0, 10)}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
