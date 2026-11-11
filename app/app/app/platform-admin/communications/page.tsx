"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import {
  ApiError,
  platformAdminApi,
  type CommunicationTemplateItem,
  type CommunicationTemplateSummary,
} from "@/lib/api";

type Tab = "all" | "pending" | "create";

const CHANNEL_LABEL: Record<string, string> = {
  sms: "SMS",
  whatsapp: "WhatsApp",
  email: "Email",
  inapp: "In-App",
};

const STATUS_LABEL: Record<string, string> = {
  dlt_approved: "DLT Approved",
  meta_approved: "Meta Approved",
  internal_approved: "Internal Approved",
  dlt_pending: "DLT Pending",
  meta_pending: "Meta Pending",
  draft: "Draft",
};

function statusClass(status: string) {
  if (status.includes("approved")) return "bg-emerald-500/15 text-emerald-600";
  if (status.includes("pending")) return "bg-amber-500/15 text-amber-600";
  return "bg-surface text-muted";
}

function formatWhen(value: string | null) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return value;
  }
}

export default function CommunicationsTemplateLibraryPage() {
  const { ensureAccessToken } = useAuth();
  const [tab, setTab] = useState<Tab>("all");
  const [items, setItems] = useState<CommunicationTemplateItem[]>([]);
  const [summary, setSummary] = useState<CommunicationTemplateSummary>({
    live: 0,
    pending: 0,
    sms: 0,
    whatsapp: 0,
    email: 0,
    inapp: 0,
  });
  const [selected, setSelected] = useState<CommunicationTemplateItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState("");
  const [channel, setChannel] = useState("sms");
  const [plugin, setPlugin] = useState("Sales Pipeline");
  const [messageType, setMessageType] = useState("Marketing / Promotional");
  const [body, setBody] = useState("");
  const [buttons, setButtons] = useState("");

  const load = useCallback(async () => {
    const data = await platformAdminApi.communicationTemplates(ensureAccessToken);
    setItems(data.items);
    setSummary(data.summary);
  }, [ensureAccessToken]);

  useEffect(() => {
    void load()
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.detail : "Could not load templates."),
      )
      .finally(() => setLoading(false));
  }, [load]);

  const pendingItems = useMemo(
    () => items.filter((item) => item.approval_status.includes("pending")),
    [items],
  );

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const channelKey =
        channel === "WhatsApp (Meta HSM)" || channel === "whatsapp"
          ? "whatsapp"
          : channel === "Email" || channel === "email"
            ? "email"
            : channel === "In-App Notification" || channel === "inapp"
              ? "inapp"
              : "sms";
      await platformAdminApi.createCommunicationTemplate(
        {
          name,
          channel: channelKey,
          plugin: plugin.replace(" Pipeline", "").replace("Digital Marketing", "Marketing"),
          message_type: messageType.split(" / ")[0] || messageType,
          body,
          buttons: buttons || undefined,
        },
        ensureAccessToken,
      );
      setMessage("Template submitted. DLT/Meta approval initiated where required.");
      setName("");
      setBody("");
      setButtons("");
      await load();
      setTab("pending");
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.detail : "Could not create template.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <p className="text-sm text-muted">Loading template library…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-extrabold tracking-tight">Template Library</h1>
      <p className="mt-1 text-sm text-muted">
        Platform-owned templates. Vendors pick from these — they cannot create from scratch.
      </p>

      <div className="mt-6 flex flex-wrap gap-2 rounded-xl border border-border bg-surface p-1">
        {(
          [
            ["all", "All Templates"],
            ["pending", `Pending Approval (${summary.pending})`],
            ["create", "+ Create New"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
              tab === key ? "bg-background text-foreground shadow-sm" : "text-muted hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <p className="mt-4 text-sm text-error">{error}</p>}
      {message && <p className="mt-4 text-sm text-emerald-600">{message}</p>}

      {tab === "all" && (
        <>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {[
              { label: "Live Templates", value: summary.live, hint: "Across all channels", color: "text-emerald-600" },
              { label: "Pending DLT / Meta", value: summary.pending, hint: "Awaiting external approval", color: "text-amber-600" },
              { label: "SMS (DLT)", value: summary.sms, hint: "Entity: XXXXXXXX", color: "text-sky-600" },
              { label: "WhatsApp HSM", value: summary.whatsapp, hint: "WABA approved", color: "text-emerald-600" },
              { label: "Email Templates", value: summary.email, hint: "", color: "text-violet-600" },
              { label: "In-App Templates", value: summary.inapp, hint: "", color: "text-fuchsia-600" },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl border border-border bg-surface p-4">
                <p className={`text-2xl font-extrabold ${stat.color}`}>{stat.value}</p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted">{stat.label}</p>
                {stat.hint ? <p className="mt-1 text-[11px] text-muted">{stat.hint}</p> : null}
              </div>
            ))}
          </div>

          <div className="mt-6 overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-surface text-xs uppercase text-muted">
                  <th className="px-3 py-2">Template Name</th>
                  <th className="px-3 py-2">Channel</th>
                  <th className="px-3 py-2">Plugin</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Approval Status</th>
                  <th className="px-3 py-2">Used by Vendors</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-border/60">
                    <td className="px-3 py-3">
                      <div className="font-semibold">{item.name}</div>
                      <div className="font-mono text-[11px] text-muted">{item.code}</div>
                    </td>
                    <td className="px-3 py-3">{CHANNEL_LABEL[item.channel] ?? item.channel}</td>
                    <td className="px-3 py-3">
                      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-700">
                        {item.plugin}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-xs font-semibold text-violet-700">
                        {item.message_type}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusClass(item.approval_status)}`}>
                        {STATUS_LABEL[item.approval_status] ?? item.approval_status}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-muted">
                      {item.vendors_using > 0 ? `${item.vendors_using} vendors` : "—"}
                    </td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() => setSelected(item)}
                        className="rounded-lg border border-border px-2.5 py-1 text-xs font-semibold hover:bg-surface"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "pending" && (
        <div className="mt-6 space-y-4">
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800">
            {summary.pending} templates are awaiting external regulatory approval. DLT (SMS) typically
            takes 1–3 business days; WhatsApp HSM typically 24–72 hours. Pending templates cannot be
            used by vendors until approved.
          </div>
          {pendingItems.length === 0 && (
            <p className="text-sm text-muted">No templates currently pending approval.</p>
          )}
          {pendingItems.map((item) => {
            const progress = Array.isArray(item.meta?.dlt_progress)
              ? (item.meta.dlt_progress as {
                  key: string;
                  title: string;
                  status: string;
                  detail: string;
                  progress_pct?: number;
                }[])
              : [];
            return (
              <div key={item.id} className="rounded-xl border border-border bg-surface p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold">{item.name}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusClass(item.approval_status)}`}>
                        {STATUS_LABEL[item.approval_status] ?? item.approval_status}
                      </span>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-muted">{item.body}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full bg-background px-2 py-0.5 font-semibold text-muted">
                        {item.message_type}
                      </span>
                      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 font-semibold text-amber-700">
                        {item.plugin}
                      </span>
                      <span className="font-mono text-muted">Submitted: {formatWhen(item.submitted_at)}</span>
                    </div>
                  </div>
                  {item.channel === "sms" && (
                    <button type="button" className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold">
                      Track on DLT Portal
                    </button>
                  )}
                </div>
                {progress.length > 0 && (
                  <div className="mt-4 border-t border-border pt-4">
                    <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-muted">
                      DLT Registration Progress
                    </p>
                    <ol className="space-y-3">
                      {progress.map((step) => (
                        <li key={step.key} className="flex gap-3">
                          <span
                            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                              step.status === "done"
                                ? "bg-emerald-500 text-white"
                                : step.status === "active"
                                  ? "bg-sky-500 text-white"
                                  : "bg-border text-muted"
                            }`}
                          >
                            {step.status === "done" ? "✓" : step.status === "active" ? "…" : "—"}
                          </span>
                          <div>
                            <p className="text-sm font-semibold">{step.title}</p>
                            <p className="text-xs text-muted">{step.detail}</p>
                            {typeof step.progress_pct === "number" && (
                              <div className="mt-2 h-1.5 max-w-[200px] overflow-hidden rounded-full bg-border">
                                <div
                                  className="h-full rounded-full bg-sky-500"
                                  style={{ width: `${step.progress_pct}%` }}
                                />
                              </div>
                            )}
                          </div>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {tab === "create" && (
        <form onSubmit={onCreate} className="mt-6 max-w-2xl space-y-4 rounded-xl border border-border bg-surface p-5">
          <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-sm text-sky-800">
            Only platform admins create templates. SMS/WhatsApp go for external approval; Email and
            In-App use internal review. Once approved, vendors see them instantly.
          </div>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold">Channel *</span>
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2"
            >
              <option value="sms">SMS (DLT-registered)</option>
              <option value="whatsapp">WhatsApp (Meta HSM)</option>
              <option value="email">Email</option>
              <option value="inapp">In-App Notification</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold">Template Name *</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="e.g. Festival Promo SMS"
              className="w-full rounded-lg border border-border bg-background px-3 py-2"
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block font-semibold">Plugin *</span>
              <select
                value={plugin}
                onChange={(e) => setPlugin(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2"
              >
                <option>Sales Pipeline</option>
                <option>Digital Marketing</option>
                <option>Publicity</option>
                <option>All Plugins</option>
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-semibold">Type *</span>
              <select
                value={messageType}
                onChange={(e) => setMessageType(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2"
              >
                <option>Marketing / Promotional</option>
                <option>Transactional</option>
                <option>Utility</option>
                <option>Service</option>
              </select>
            </label>
          </div>
          {channel === "sms" && (
            <div className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
              <p className="font-semibold">DLT Sender Header</p>
              <p className="font-mono text-muted">CRAFTD · Fixed, registered with TRAI</p>
            </div>
          )}
          <label className="block text-sm">
            <span className="mb-1 block font-semibold">Message Body *</span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
              rows={5}
              placeholder="Use {#var#} for SMS variables, {{1}} {{2}} for WhatsApp HSM variables."
              className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm"
            />
          </label>
          {channel === "whatsapp" && (
            <label className="block text-sm">
              <span className="mb-1 block font-semibold">WhatsApp Buttons (optional)</span>
              <input
                value={buttons}
                onChange={(e) => setButtons(e.target.value)}
                placeholder="Interested / Not Now"
                className="w-full rounded-lg border border-border bg-background px-3 py-2"
              />
            </label>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {busy ? "Submitting…" : "Submit for Approval →"}
            </button>
          </div>
        </form>
      )}

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-background p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">{selected.name}</h2>
                <p className="font-mono text-xs text-muted">{selected.code}</p>
              </div>
              <button type="button" onClick={() => setSelected(null)} className="text-muted hover:text-foreground">
                ✕
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full bg-surface px-2 py-0.5 text-xs font-semibold">
                {CHANNEL_LABEL[selected.channel] ?? selected.channel}
              </span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusClass(selected.approval_status)}`}>
                {STATUS_LABEL[selected.approval_status] ?? selected.approval_status}
              </span>
              <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-xs font-semibold text-violet-700">
                {selected.message_type}
              </span>
            </div>
            <p className="mt-4 whitespace-pre-wrap rounded-lg border border-border bg-surface p-3 font-mono text-sm">
              {selected.body}
            </p>
            {selected.variable_map.length > 0 && (
              <div className="mt-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted">
                  Vendor Variable Mapping
                </p>
                <ul className="mt-2 space-y-1 text-sm">
                  {selected.variable_map.map((variable) => (
                    <li key={variable.index} className="flex gap-2">
                      <span className="rounded bg-amber-500/15 px-1.5 font-mono text-xs text-amber-700">
                        var {variable.index}
                      </span>
                      <span className="text-muted">→ {variable.label}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="mt-4 text-xs text-muted">
              Used by <strong className="text-foreground">{selected.vendors_using} vendors</strong>
              {" · "}
              {selected.messages_sent_month.toLocaleString()} messages this month
            </p>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
