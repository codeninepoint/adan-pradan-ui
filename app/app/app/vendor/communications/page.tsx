"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { useVendorPortal } from "@/components/vendor/portal";
import {
  ApiError,
  marketplaceApi,
  type VendorCommunicationLog,
  type VendorCommunicationLogs,
  type VendorCommunicationTemplate,
  type VendorCommunicationsHub,
} from "@/lib/api";

type Tab = "hub" | "templates" | "compose" | "logs";

const CHANNEL_LABEL: Record<string, string> = {
  sms: "SMS",
  whatsapp: "WhatsApp",
  email: "Email",
  inapp: "In-App",
};

const CHANNEL_ICON: Record<string, string> = {
  sms: "📱",
  whatsapp: "💬",
  email: "✉",
  inapp: "🔔",
};

const APPROVED = new Set(["dlt_approved", "meta_approved", "internal_approved"]);

function statusBadge(status: string) {
  if (status === "dlt_approved") return { label: "DLT ✓", className: "bg-emerald-500/15 text-emerald-700" };
  if (status === "meta_approved") return { label: "Meta ✓", className: "bg-emerald-500/15 text-emerald-700" };
  if (status === "internal_approved") return { label: "Approved", className: "bg-emerald-500/15 text-emerald-700" };
  if (status === "dlt_pending") return { label: "DLT Pending", className: "bg-amber-500/15 text-amber-700" };
  if (status === "meta_pending") return { label: "Meta Pending", className: "bg-amber-500/15 text-amber-700" };
  return { label: status, className: "bg-surface text-muted" };
}

function formatWhen(value: string) {
  try {
    const date = new Date(value);
    const today = new Date();
    if (date.toDateString() === today.toDateString()) {
      return `Today ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    }
    return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return value;
  }
}

function pct(part: number, whole: number) {
  if (!whole) return "—";
  return `${Math.round((part / whole) * 100)}%`;
}

function renderPreview(body: string, variables: Record<string, string>) {
  let text = body;
  const named = Object.entries(variables);
  for (const [key, value] of named) {
    text = text.replaceAll(`{${key}}`, value || `{${key}}`);
    text = text.replaceAll(`{{${key}}}`, value || `{{${key}}}`);
  }
  // Fill sequential {#var#} / {{n}} placeholders in order.
  const values = named.map(([, value]) => value).filter(Boolean);
  let index = 0;
  text = text.replace(/\{#var#\}/g, () => values[index++] || "[variable]");
  index = 0;
  text = text.replace(/\{\{(\d+)\}\}/g, () => values[index++] || "[variable]");
  return text;
}

export default function VendorCommunicationsPage() {
  const { vendor } = useVendorPortal();
  const { ensureAccessToken } = useAuth();
  const [tab, setTab] = useState<Tab>("hub");
  const [hub, setHub] = useState<VendorCommunicationsHub | null>(null);
  const [templates, setTemplates] = useState<VendorCommunicationTemplate[]>([]);
  const [logs, setLogs] = useState<VendorCommunicationLogs | null>(null);
  const [channelFilter, setChannelFilter] = useState("all");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [composeChannel, setComposeChannel] = useState("sms");
  const [templateId, setTemplateId] = useState("");
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [audience, setAudience] = useState("Single Contact");
  const [schedule, setSchedule] = useState("now");
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestName, setRequestName] = useState("");
  const [requestChannel, setRequestChannel] = useState("sms");
  const [requestNotes, setRequestNotes] = useState("");

  const load = useCallback(async () => {
    if (!vendor) return;
    const [hubData, templateData, logData] = await Promise.all([
      marketplaceApi.vendorCommunicationsHub(vendor.vendor_id, ensureAccessToken),
      marketplaceApi.vendorCommunicationTemplates(vendor.vendor_id, ensureAccessToken),
      marketplaceApi.vendorCommunicationLogs(vendor.vendor_id, ensureAccessToken),
    ]);
    setHub(hubData);
    setTemplates(templateData.items);
    setLogs(logData);
    setTemplateId((current) => {
      if (current) return current;
      const firstApproved = templateData.items.find(
        (item) => item.channel === "sms" && APPROVED.has(item.approval_status),
      );
      if (!firstApproved) return current;
      if (firstApproved.code === "CRAFTD_PROMO_01") {
        setVariables({ name: "", discount: "", product: "", code: "", link: "" });
      }
      return firstApproved.id;
    });
  }, [vendor, ensureAccessToken]);

  useEffect(() => {
    void load().catch((err: unknown) =>
      setError(err instanceof ApiError ? err.detail : "Could not load communications."),
    );
  }, [load]);

  const approvedForChannel = useMemo(
    () =>
      templates.filter(
        (item) => item.channel === composeChannel && APPROVED.has(item.approval_status),
      ),
    [templates, composeChannel],
  );

  const selectedTemplate = useMemo(
    () => templates.find((item) => item.id === templateId) ?? approvedForChannel[0] ?? null,
    [templates, templateId, approvedForChannel],
  );

  const filteredTemplates = useMemo(() => {
    if (channelFilter === "all") return templates;
    return templates.filter((item) => item.channel === channelFilter);
  }, [templates, channelFilter]);

  const channelCounts = useMemo(() => {
    const counts = { all: templates.length, sms: 0, whatsapp: 0, email: 0, inapp: 0 };
    for (const item of templates) {
      if (item.channel in counts) counts[item.channel as keyof typeof counts] += 1;
    }
    return counts;
  }, [templates]);

  function openCompose(template?: VendorCommunicationTemplate) {
    if (template) {
      setComposeChannel(template.channel);
      setTemplateId(template.id);
      if (template.code === "CRAFTD_PROMO_01") {
        setVariables({ name: "Priya", discount: "20", product: "Clay Diyas", code: "DIWALI20", link: "adanpradan.com/cr" });
      } else if (template.code === "WA_CAM_LAUNCH_01") {
        setVariables({ name: "Priya", brand: "Crafted Roots", product: "Diwali Collection", link: "adanpradan.com/cr" });
      } else {
        const next: Record<string, string> = {};
        for (const variable of template.variable_map) {
          next[`var_${variable.index}`] = "";
        }
        setVariables(next);
      }
    }
    setTab("compose");
  }

  async function onSend(event?: FormEvent) {
    event?.preventDefault();
    if (!vendor || !selectedTemplate) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await marketplaceApi.sendVendorCommunication(
        vendor.vendor_id,
        {
          template_id: selectedTemplate.id,
          audience,
          variables,
          contact_name: variables.name || variables.var_1 || undefined,
          schedule,
        },
        ensureAccessToken,
      );
      setConfirmOpen(false);
      setMessage(
        `Message sent successfully (${result.sent} recipient · ~₹${result.estimated_cost_inr.toFixed(2)}).`,
      );
      setTab("logs");
      await load();
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.detail : "Send failed.");
    } finally {
      setBusy(false);
    }
  }

  async function onRequestTemplate(event: FormEvent) {
    event.preventDefault();
    if (!vendor) return;
    setBusy(true);
    setError(null);
    try {
      await marketplaceApi.requestVendorCommunicationTemplate(
        vendor.vendor_id,
        { name: requestName, channel: requestChannel, notes: requestNotes },
        ensureAccessToken,
      );
      setRequestOpen(false);
      setRequestName("");
      setRequestNotes("");
      setMessage("Template request sent to platform admin. You’ll be notified once it’s approved.");
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.detail : "Could not submit request.");
    } finally {
      setBusy(false);
    }
  }

  if (!vendor) return null;
  if (!hub || !logs) {
    return <p className="text-sm text-muted">Loading communications…</p>;
  }

  const previewText = selectedTemplate
    ? renderPreview(selectedTemplate.body, variables)
    : "Select a template to preview.";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Vendor Plugin</p>
          <h1 className="text-2xl font-extrabold tracking-tight">Communications</h1>
          <p className="mt-1 text-sm text-muted">
            Send SMS, Email, WhatsApp & In-App messages using platform-approved templates.
          </p>
        </div>
        <button
          type="button"
          onClick={() => openCompose()}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          + Compose Message
        </button>
      </div>

      <div className="flex flex-wrap gap-2 rounded-xl border border-border bg-surface p-1">
        {(
          [
            ["hub", "Hub"],
            ["templates", "Templates"],
            ["compose", "Compose & Send"],
            ["logs", "Delivery Logs"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`rounded-lg px-3 py-2 text-sm font-semibold ${
              tab === key ? "bg-background text-foreground shadow-sm" : "text-muted hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-error">{error}</p>}
      {message && <p className="text-sm text-emerald-600">{message}</p>}

      {tab === "hub" && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Sent This Month", value: hub.summary.sent_this_month.toLocaleString(), color: "text-sky-600", hint: "↑ 18% vs last month" },
              { label: "Delivery Rate", value: `${hub.summary.delivery_rate}%`, color: "text-emerald-600" },
              { label: "Active Campaigns", value: String(hub.summary.active_campaigns), color: "text-amber-600" },
              { label: "Templates Available", value: String(hub.summary.templates_available), color: "text-violet-600" },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl border border-border bg-surface p-4">
                <p className={`text-2xl font-extrabold ${stat.color}`}>{stat.value}</p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted">{stat.label}</p>
                {stat.hint ? <p className="mt-1 text-[11px] text-emerald-600">{stat.hint}</p> : null}
              </div>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(["sms", "whatsapp", "email", "inapp"] as const).map((channel) => {
              const stats = hub.summary.by_channel[channel] || { sent: 0, delivered: 0, delivery_rate: 0 };
              return (
                <div key={channel} className="rounded-xl border border-border bg-surface p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-sm">{CHANNEL_ICON[channel]}</span>
                    <span className="text-sm font-bold">{CHANNEL_LABEL[channel]}</span>
                    {stats.badge ? (
                      <span className="ml-auto rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                        {stats.badge}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xl font-extrabold">{stats.sent.toLocaleString()}</p>
                  <p className="text-xs text-muted">
                    sent · {stats.delivery_rate ?? pct(stats.delivered, stats.sent)} delivery
                  </p>
                </div>
              );
            })}
          </div>

          <div>
            <h2 className="mb-3 text-sm font-bold">Recent Sends</h2>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface text-xs uppercase text-muted">
                    <th className="px-3 py-2">When</th>
                    <th className="px-3 py-2">Channel</th>
                    <th className="px-3 py-2">Template</th>
                    <th className="px-3 py-2">Audience</th>
                    <th className="px-3 py-2">Sent</th>
                    <th className="px-3 py-2">Delivered</th>
                    <th className="px-3 py-2">Read / Clicked</th>
                  </tr>
                </thead>
                <tbody>
                  {hub.recent.map((item) => (
                    <tr key={item.id} className="border-b border-border/60">
                      <td className="px-3 py-3 font-mono text-xs">{formatWhen(item.occurred_at)}</td>
                      <td className="px-3 py-3">{CHANNEL_ICON[item.channel] ?? item.channel}</td>
                      <td className="px-3 py-3 font-semibold">{item.template_name}</td>
                      <td className="px-3 py-3 text-muted">{item.audience}</td>
                      <td className="px-3 py-3">{item.sent}</td>
                      <td className="px-3 py-3 text-emerald-600">
                        {item.delivered ?? "—"}
                        {item.delivered != null ? ` (${pct(item.delivered, item.sent)})` : ""}
                      </td>
                      <td className="px-3 py-3 text-sky-600">
                        {item.read_count > 0 ? `${item.read_count} (${pct(item.read_count, item.sent)})` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === "templates" && (
        <>
          <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm text-sky-800">
            Templates are created and DLT/Meta-approved by the platform admin. You pick from these and
            fill in your variable values.
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                ["all", `All (${channelCounts.all})`],
                ["sms", `📱 SMS (${channelCounts.sms})`],
                ["whatsapp", `💬 WhatsApp (${channelCounts.whatsapp})`],
                ["email", `✉ Email (${channelCounts.email})`],
                ["inapp", `🔔 In-App (${channelCounts.inapp})`],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setChannelFilter(key)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                  channelFilter === key
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted"
                }`}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setRequestOpen(true)}
              className="ml-auto rounded-lg border border-border px-3 py-1.5 text-xs font-semibold"
            >
              ✉ Request a Template
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filteredTemplates.map((item) => {
              const badge = statusBadge(item.approval_status);
              const usable = APPROVED.has(item.approval_status);
              return (
                <div
                  key={item.id}
                  className={`rounded-xl border border-border bg-surface p-4 ${usable ? "" : "opacity-65"}`}
                >
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{item.name}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${badge.className}`}>
                      {badge.label}
                    </span>
                  </div>
                  <p className="mb-3 border-l-2 border-border pl-2 font-mono text-xs leading-relaxed text-muted">
                    {item.body}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm">{CHANNEL_ICON[item.channel]}</span>
                    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                      {item.plugin}
                    </span>
                    {usable ? (
                      <button
                        type="button"
                        onClick={() => openCompose(item)}
                        className="ml-auto rounded-lg bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground"
                      >
                        Use →
                      </button>
                    ) : (
                      <span className="ml-auto text-[11px] text-muted">Available after approval</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {tab === "compose" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <form
            className="space-y-4 rounded-xl border border-border bg-surface p-4"
            onSubmit={(e) => {
              e.preventDefault();
              setConfirmOpen(true);
            }}
          >
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">Step 1 — Channel</p>
              <div className="grid grid-cols-2 gap-2">
                {(["sms", "whatsapp", "email", "inapp"] as const).map((channel) => (
                  <button
                    key={channel}
                    type="button"
                    onClick={() => {
                      setComposeChannel(channel);
                      const next = templates.find(
                        (item) => item.channel === channel && APPROVED.has(item.approval_status),
                      );
                      setTemplateId(next?.id ?? "");
                    }}
                    className={`rounded-lg border px-3 py-2 text-left text-sm font-semibold ${
                      composeChannel === channel
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted"
                    }`}
                  >
                    {CHANNEL_ICON[channel]} {CHANNEL_LABEL[channel]}
                  </button>
                ))}
              </div>
            </div>

            <label className="block text-sm">
              <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-muted">
                Step 2 — Pick Template
              </span>
              <select
                value={selectedTemplate?.id ?? ""}
                onChange={(e) => {
                  const next = templates.find((item) => item.id === e.target.value);
                  if (next) openCompose(next);
                }}
                className="w-full rounded-lg border border-border bg-background px-3 py-2"
              >
                {approvedForChannel.length === 0 && <option value="">No approved templates</option>}
                {approvedForChannel.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} — {item.plugin}
                  </option>
                ))}
              </select>
            </label>

            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">
                Step 3 — Fill Variables
              </p>
              <div className="space-y-2">
                {Object.keys(variables).length === 0 && (
                  <p className="text-xs text-muted">This template has no variables.</p>
                )}
                {Object.entries(variables).map(([key, value]) => (
                  <div key={key} className="flex items-center gap-2">
                    <span className="w-24 shrink-0 font-mono text-xs text-amber-700">{`{${key}}`}</span>
                    <input
                      value={value}
                      onChange={(e) => setVariables((prev) => ({ ...prev, [key]: e.target.value }))}
                      className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
                      placeholder={key}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">
                Step 4 — Choose Audience
              </p>
              <div className="mb-2 flex flex-wrap gap-2">
                {["Single Contact", "By Tag / Segment", "All Buyers", "New / Prospects"].map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setAudience(option)}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                      audience === option
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted"
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">Step 5 — When</p>
              <div className="flex gap-2">
                {[
                  ["now", "Send Now"],
                  ["later", "Schedule"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setSchedule(value)}
                    className={`rounded-lg border px-3 py-1.5 text-sm font-semibold ${
                      schedule === value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
                Send Message →
              </button>
            </div>
          </form>

          <div className="space-y-3">
            <div className="rounded-xl border border-border bg-surface p-4">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted">Message Preview</p>
              <pre className="whitespace-pre-wrap rounded-lg border border-emerald-900/40 bg-[#0d1a0d] p-3 font-mono text-xs leading-relaxed text-emerald-100">
                {previewText}
              </pre>
              <div className="mt-2 flex justify-between text-[11px] text-muted">
                <span>{previewText.length} chars</span>
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 font-bold text-emerald-700">
                  Within limit ✓
                </span>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-surface p-4 text-sm">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted">Audience Check</p>
              <div className="space-y-1">
                <div className="flex justify-between"><span className="text-muted">Matched contacts</span><span className="font-mono">1</span></div>
                <div className="flex justify-between"><span className="text-muted">DND/NDNC removed</span><span className="font-mono text-rose-600">0</span></div>
                <div className="flex justify-between"><span className="text-muted">Opted out</span><span className="font-mono text-rose-600">0</span></div>
                <div className="flex justify-between border-t border-border pt-1 font-semibold"><span>Will receive</span><span className="font-mono text-emerald-600">1</span></div>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-surface p-4 text-sm">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted">Compliance</p>
              <ul className="space-y-1">
                {[
                  "DLT / Meta Template Approved",
                  `Sender Header: ${logs.compliance.sender_header || "CRAFTD"}`,
                  "NDNC Scrub Passed",
                  "Opt-out footer present",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <span className="rounded-full bg-emerald-500/15 px-1.5 text-[10px] font-bold text-emerald-700">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {tab === "logs" && (
        <>
          {logs.campaign && (
            <div className="rounded-xl border border-border bg-surface p-4">
              <p className="mb-3 text-sm font-semibold">{logs.campaign.title}</p>
              {(
                [
                  ["Targeted", logs.campaign.targeted, 100, "#334155"],
                  ["Sent", logs.campaign.sent, 96, "#1d4ed8"],
                  ["Delivered", logs.campaign.delivered, 94, "#0369a1"],
                  ["Read", logs.campaign.read, 44, "#0d9488"],
                  ["Replied", logs.campaign.replied, 12, "#059669"],
                  ["Opted Out", logs.campaign.opted_out, 2, "#b91c1c"],
                ] as const
              ).map(([label, value, width, color]) => (
                <div key={label} className="mb-2 flex items-center gap-3 text-sm">
                  <div className="w-20 text-xs font-semibold uppercase text-muted">{label}</div>
                  <div className="h-3.5 flex-1 overflow-hidden rounded bg-background">
                    <div
                      className="flex h-full items-center rounded px-1.5 text-[9px] font-bold text-white"
                      style={{ width: `${width}%`, background: color }}
                    >
                      {value}
                    </div>
                  </div>
                  <div className="w-10 text-right font-mono text-xs text-muted">{value}</div>
                </div>
              ))}
            </div>
          )}

          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-surface text-xs uppercase text-muted">
                  <th className="px-3 py-2">Contact</th>
                  <th className="px-3 py-2">Ch</th>
                  <th className="px-3 py-2">Template</th>
                  <th className="px-3 py-2">Sent</th>
                  <th className="px-3 py-2">Delivered</th>
                  <th className="px-3 py-2">Read</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {logs.items.map((item: VendorCommunicationLog) => (
                  <tr key={item.id} className="border-b border-border/60">
                    <td className="px-3 py-3">{item.contact_name || item.audience}</td>
                    <td className="px-3 py-3">{CHANNEL_ICON[item.channel]}</td>
                    <td className="px-3 py-3">{item.template_name}</td>
                    <td className="px-3 py-3 font-mono text-xs">{formatWhen(item.occurred_at)}</td>
                    <td className="px-3 py-3 font-mono text-xs">
                      {item.delivered != null ? formatWhen(item.occurred_at) : "—"}
                    </td>
                    <td className="px-3 py-3 font-mono text-xs">
                      {item.read_count > 0 ? String(item.read_count) : "—"}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          item.replied_count > 0
                            ? "bg-emerald-500/15 text-emerald-700"
                            : item.read_count > 0
                              ? "bg-sky-500/15 text-sky-700"
                              : item.delivered
                                ? "bg-surface text-muted"
                                : "bg-rose-500/15 text-rose-700"
                        }`}
                      >
                        {item.replied_count > 0
                          ? "Replied"
                          : item.read_count > 0
                            ? "Read"
                            : item.delivered
                              ? "Delivered"
                              : "Not Delivered"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {confirmOpen && selectedTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setConfirmOpen(false)}>
          <div
            className="w-full max-w-md rounded-2xl border border-border bg-background p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold">Confirm Send</h2>
            <p className="text-sm text-muted">Review before sending</p>
            <div className="mt-4 overflow-hidden rounded-xl border border-border text-sm">
              {[
                ["Channel", `${CHANNEL_ICON[selectedTemplate.channel]} ${CHANNEL_LABEL[selectedTemplate.channel]}`],
                ["Template", selectedTemplate.name],
                ["Recipients (post DND scrub)", "1"],
                ["Est. cost", selectedTemplate.channel === "sms" ? "~₹0.25" : "~₹0.45"],
                ["Scheduled", schedule === "now" ? "Send Now" : "Scheduled"],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between border-b border-border px-3 py-2 last:border-b-0">
                  <span className="text-muted">{label}</span>
                  <span className="font-semibold">{value}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800">
              ✓ All compliance checks passed. Template approved. NDNC scrub done.
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmOpen(false)} className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold">
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void onSend()}
                className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                {busy ? "Sending…" : "Confirm Send →"}
              </button>
            </div>
          </div>
        </div>
      )}

      {requestOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setRequestOpen(false)}>
          <form
            className="w-full max-w-md space-y-3 rounded-2xl border border-border bg-background p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            onSubmit={onRequestTemplate}
          >
            <h2 className="text-lg font-bold">Request a Template</h2>
            <label className="block text-sm">
              <span className="mb-1 block font-semibold">Template name</span>
              <input
                required
                value={requestName}
                onChange={(e) => setRequestName(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-semibold">Channel</span>
              <select
                value={requestChannel}
                onChange={(e) => setRequestChannel(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2"
              >
                <option value="sms">SMS</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="email">Email</option>
                <option value="inapp">In-App</option>
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-semibold">Notes</span>
              <textarea
                value={requestNotes}
                onChange={(e) => setRequestNotes(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-border bg-background px-3 py-2"
              />
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setRequestOpen(false)} className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold">
                Cancel
              </button>
              <button type="submit" disabled={busy} className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                Submit request
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
