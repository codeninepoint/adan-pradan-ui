"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import {
  ApiError,
  platformAdminApi,
  type CommunicationUsageItem,
  type CommunicationUsageSummary,
} from "@/lib/api";

const CHANNEL_LABEL: Record<string, string> = {
  sms: "SMS",
  whatsapp: "WhatsApp",
  email: "Email",
  inapp: "In-App",
};

function formatWhen(value: string) {
  try {
    return new Date(value).toLocaleString(undefined, {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

export default function CommunicationsUsagePage() {
  const { ensureAccessToken } = useAuth();
  const [items, setItems] = useState<CommunicationUsageItem[]>([]);
  const [summary, setSummary] = useState<CommunicationUsageSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const data = await platformAdminApi.communicationUsage(ensureAccessToken);
    setItems(data.items);
    setSummary(data.summary);
  }, [ensureAccessToken]);

  useEffect(() => {
    void load()
      .catch((err: unknown) => setError(err instanceof ApiError ? err.detail : "Could not load usage logs."))
      .finally(() => setLoading(false));
  }, [load]);

  if (loading || !summary) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <p className="text-sm text-muted">Loading usage logs…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Platform Usage Logs</h1>
          <p className="mt-1 text-sm text-muted">
            All messages sent across all vendors, all channels. Full audit trail.
          </p>
        </div>
        <button type="button" className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold">
          Export CSV
        </button>
      </div>

      {error && <p className="mt-4 text-sm text-error">{error}</p>}

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {[
          { label: "Messages This Month", value: summary.messages_this_month, color: "text-sky-600" },
          { label: "SMS Sent", value: summary.sms_sent, color: "text-emerald-600" },
          { label: "WhatsApp", value: summary.whatsapp_sent, color: "text-emerald-600" },
          { label: "Email", value: summary.email_sent, color: "text-sky-600" },
          { label: "In-App", value: summary.inapp_sent, color: "text-violet-600" },
          { label: "Failed / Opted-out", value: summary.failed_or_opted_out, color: "text-rose-600" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-border bg-surface p-4">
            <p className={`text-2xl font-extrabold ${stat.color}`}>{stat.value.toLocaleString()}</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-surface text-xs uppercase text-muted">
              <th className="px-3 py-2">Time</th>
              <th className="px-3 py-2">Vendor</th>
              <th className="px-3 py-2">Channel</th>
              <th className="px-3 py-2">Template</th>
              <th className="px-3 py-2">Audience</th>
              <th className="px-3 py-2">Sent</th>
              <th className="px-3 py-2">Delivered</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-border/60">
                <td className="px-3 py-3 font-mono text-xs">{formatWhen(item.occurred_at)}</td>
                <td className="px-3 py-3">{item.vendor_name}</td>
                <td className="px-3 py-3">{CHANNEL_LABEL[item.channel] ?? item.channel}</td>
                <td className="px-3 py-3">{item.template_name}</td>
                <td className="px-3 py-3 text-muted">{item.audience}</td>
                <td className="px-3 py-3">{item.sent}</td>
                <td className="px-3 py-3">{item.delivered ?? "—"}</td>
                <td className="px-3 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      item.status === "done"
                        ? "bg-emerald-500/15 text-emerald-700"
                        : "bg-amber-500/15 text-amber-700"
                    }`}
                  >
                    {item.status === "done" ? "Done" : item.status.replace(/_/g, " ")}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {summary.warning && (
        <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800">
          {summary.warning}
        </div>
      )}
    </main>
  );
}
