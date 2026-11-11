"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { ApiError, platformAdminApi } from "@/lib/api";

type DltData = Awaited<ReturnType<typeof platformAdminApi.communicationDlt>>;

function formatWhen(value: string | null) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short" });
  } catch {
    return value;
  }
}

export default function CommunicationsDltPage() {
  const { ensureAccessToken } = useAuth();
  const [data, setData] = useState<DltData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setData(await platformAdminApi.communicationDlt(ensureAccessToken));
  }, [ensureAccessToken]);

  useEffect(() => {
    void load()
      .catch((err: unknown) => setError(err instanceof ApiError ? err.detail : "Could not load DLT center."))
      .finally(() => setLoading(false));
  }, [load]);

  if (loading) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <p className="text-sm text-muted">Loading DLT compliance…</p>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {error && <p className="text-sm text-error">{error}</p>}
      </main>
    );
  }

  const { entity, template_stats: stats, whatsapp, pending_registrations: pending } = data;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-extrabold tracking-tight">DLT Compliance Center</h1>
      <p className="mt-1 text-sm text-muted">
        TRAI blockchain registration status for SMS. One entity ID covers all vendors on the platform.
      </p>

      {error && <p className="mt-4 text-sm text-error">{error}</p>}

      <div className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800">
        <strong>Entity Registration: Active.</strong> Entity ID registered on {entity.registered_on}.
        Annual renewal due {entity.renewal}.
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Entity Details</p>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-3"><dt className="text-muted">Entity Name</dt><dd className="font-mono">{entity.entity_name}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted">Entity ID</dt><dd className="font-mono text-sky-600">{entity.entity_id}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted">Registered on</dt><dd className="font-mono">{entity.registered_on}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted">Renewal</dt><dd className="font-mono text-emerald-600">{entity.renewal}</dd></div>
          </dl>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Sender Headers</p>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-lg font-extrabold text-sky-600">{entity.sender_header}</span>
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-700">Active</span>
          </div>
          <p className="mt-2 text-xs text-muted">
            All vendor SMS goes from this header. Recipients see {entity.sender_header} in the sender field.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Template Stats</p>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-muted">Total registered</dt><dd className="font-mono">{stats.total_registered}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Promotional</dt><dd className="font-mono">{stats.promotional}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Transactional</dt><dd className="font-mono">{stats.transactional}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Pending</dt><dd className="font-mono text-amber-600">{stats.pending}</dd></div>
          </dl>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted">WhatsApp WABA</p>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-muted">Business Account</dt><dd className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold capitalize text-emerald-700">{whatsapp.business_account}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">BSP</dt><dd className="font-mono">{whatsapp.bsp}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">HSM Templates</dt><dd className="font-mono">{whatsapp.hsm_live} live, {whatsapp.hsm_pending} pending</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Free conv/month</dt><dd className="font-mono text-emerald-600">{whatsapp.free_conversations_month.toLocaleString()}</dd></div>
          </dl>
        </div>
      </div>

      <h2 className="mt-8 text-lg font-bold">Pending DLT Template Registrations</h2>
      <div className="mt-3 overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[700px] text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-surface text-xs uppercase text-muted">
              <th className="px-3 py-2">Template</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">DLT Reference</th>
              <th className="px-3 py-2">Submitted</th>
              <th className="px-3 py-2">Expected</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {pending.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-muted">No pending DLT registrations.</td>
              </tr>
            )}
            {pending.map((row) => (
              <tr key={row.id} className="border-b border-border/60">
                <td className="px-3 py-3 font-semibold">{row.name}</td>
                <td className="px-3 py-3">{row.message_type}</td>
                <td className="px-3 py-3 font-mono text-xs">{row.dlt_reference ?? "—"}</td>
                <td className="px-3 py-3">{formatWhen(row.submitted_at)}</td>
                <td className="px-3 py-3">{row.expected_by ? formatWhen(row.expected_by) : "—"}</td>
                <td className="px-3 py-3">
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-700">
                    Under Review
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
