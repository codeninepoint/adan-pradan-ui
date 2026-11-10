"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { useVendorPortal } from "@/components/vendor/portal";
import { ApiError, marketplaceApi, PublicityBoard } from "@/lib/api";

const TABS = ["Press Release", "Media Kit", "Influencers", "Coverage"];
const TOOLS = ["H1", "H2", "B", "I", "Quote", "Link"];

const selectClass =
  "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary";

export default function VendorPublicityPage() {
  const { vendor } = useVendorPortal();
  const { ensureAccessToken } = useAuth();
  const [board, setBoard] = useState<PublicityBoard | null>(null);
  const [notImported, setNotImported] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [tab, setTab] = useState("Press Release");
  const [busy, setBusy] = useState<string | null>(null);
  const [template, setTemplate] = useState("product-launch");
  const [distribution, setDistribution] = useState("media-contacts");
  const [headline, setHeadline] = useState("");
  const [body, setBody] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [topic, setTopic] = useState("");

  const load = useCallback(async () => {
    if (!vendor) return;
    try {
      const data = await marketplaceApi.publicityBoard(vendor.vendor_id, ensureAccessToken);
      setBoard(data);
      setNotImported(false);
      const draft = data.releases.find((r) => r.status === "draft");
      if (draft) {
        setEditingId(draft.release_id);
        setHeadline(draft.headline);
        setBody(draft.body);
        setTemplate(draft.template);
        setDistribution(draft.distribution);
      }
    } catch (err) {
      if (err instanceof ApiError && (err.status === 404 || err.status === 403)) {
        setNotImported(true);
      } else {
        throw err;
      }
    }
  }, [vendor, ensureAccessToken]);

  useEffect(() => {
    void load().catch((err: unknown) =>
      setError(err instanceof ApiError ? err.detail : "Could not load publicity."),
    );
  }, [load]);

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

  if (notImported) {
    return (
      <div className="rounded-xl border border-border bg-surface p-6">
        <h1 className="text-xl font-bold">Publicity is not imported yet</h1>
        <p className="mt-2 text-sm text-muted">
          Import the free Standard Plugin (currently in Beta) from the Plugin Store — the 4-step
          wizard takes under a minute, and your press release studio appears here.
        </p>
        <Link
          href="/app/vendor/plugin-store"
          className="mt-4 inline-block rounded-lg bg-violet-500 px-4 py-2 text-sm font-bold text-white hover:bg-violet-600"
        >
          Go to Plugin Store
        </Link>
      </div>
    );
  }

  if (!board) return <p className="text-sm text-muted">Loading your publicity studio…</p>;

  function newRelease() {
    setEditingId(null);
    setHeadline("");
    setBody("");
    setPreview(false);
    setTab("Press Release");
  }

  async function save(status: "draft" | "sent") {
    if (!vendor) return;
    await run(`save-${status}`, async () => {
      if (editingId) {
        await marketplaceApi.updatePressRelease(
          vendor.vendor_id,
          editingId,
          { headline, body, template, distribution, status },
          ensureAccessToken,
        );
      } else {
        await marketplaceApi.createPressRelease(
          vendor.vendor_id,
          { headline, body, template, distribution, status },
          ensureAccessToken,
        );
      }
      setMessage(status === "sent" ? "Press release distributed." : "Draft saved.");
    });
  }

  return (
    <div>
      <p className="text-xs text-muted">
        <Link href="/app/vendor/plugin-store" className="hover:underline">Plugin Store</Link>
        <span className="mx-1">/</span>
        <span className="font-semibold text-foreground">Publicity</span>
      </p>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">📰 Publicity</h1>
          <p className="mt-1 text-xs text-muted">
            {board.active_modules} active modules · {board.stats.releases_sent} press releases sent ·{" "}
            {board.ai_tokens_per_month.toLocaleString("en-IN")} AI tokens/month from platform quota
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/app/vendor/plugin-settings" className="rounded-lg border border-border px-3 py-2 text-sm font-semibold">
            ⚙ Settings
          </Link>
          <button
            type="button"
            onClick={newRelease}
            className="cursor-pointer rounded-lg bg-violet-500 px-4 py-2 text-sm font-bold text-white hover:bg-violet-600"
          >
            + New Release
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {TABS.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTab(item)}
            className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold ${
              tab === item ? "bg-primary text-primary-foreground" : "border border-border text-muted"
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      {message && <p className="mt-4 text-sm font-semibold text-emerald-600">{message}</p>}
      {error && <p className="mt-4 text-sm text-error">{error}</p>}

      {tab === "Press Release" && (
        <div className="mt-6">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-[10px] font-bold uppercase tracking-widest text-muted">
              Template
              <select value={template} onChange={(e) => setTemplate(e.target.value)} className={selectClass}>
                {board.templates.map((item) => (
                  <option key={item.key} value={item.key}>{item.label}</option>
                ))}
              </select>
            </label>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-muted">
              Distribution
              <select value={distribution} onChange={(e) => setDistribution(e.target.value)} className={selectClass}>
                {board.distributions.map((item) => (
                  <option key={item.key} value={item.key}>{item.label}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-4 rounded-xl border border-border bg-surface">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2">
              <div className="flex gap-1">
                {TOOLS.map((tool) => (
                  <button
                    key={tool}
                    type="button"
                    onClick={() => {
                      if (tool === "H1" || tool === "H2") setBody((b) => `${b}\n\n${tool === "H1" ? "# " : "## "}`);
                      if (tool === "Quote") setBody((b) => `${b}\n\n> `);
                      if (tool === "Link") setBody((b) => `${b} [link text](https://)`);
                    }}
                    className="cursor-pointer rounded border border-border px-2 py-1 text-[11px] font-semibold"
                  >
                    {tool}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Topic for AI draft…"
                  aria-label="AI draft topic"
                  className="w-44 rounded-lg border border-border bg-background px-2 py-1 text-xs outline-none focus:border-primary"
                />
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() =>
                    void run("ai-draft", async () => {
                      const draft = await marketplaceApi.publicityAiDraft(
                        vendor.vendor_id,
                        { template, topic: topic || undefined },
                        ensureAccessToken,
                      );
                      setHeadline(draft.headline);
                      setBody(draft.body);
                      setEditingId(null);
                      setMessage("AI draft generated — edit, save, then distribute.");
                    })
                  }
                  className="cursor-pointer rounded-lg border border-violet-500/50 px-2.5 py-1 text-xs font-bold text-violet-600 disabled:opacity-50"
                >
                  {busy === "ai-draft" ? "Drafting…" : "✦ AI Draft"}
                </button>
              </div>
            </div>
            <div className="p-4">
              <input
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="Headline — e.g. Crafted Roots Co. Launches New Diwali Artisan Collection"
                aria-label="Press release headline"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold outline-none focus:border-primary"
              />
              {preview ? (
                <article className="prose-sm mt-3 min-h-[180px] whitespace-pre-wrap rounded-lg bg-background p-4 text-sm leading-relaxed">
                  {body || "Nothing to preview yet."}
                </article>
              ) : (
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={9}
                  aria-label="Press release body"
                  placeholder={"FOR IMMEDIATE RELEASE\n\nWrite or generate your release…"}
                  className="mt-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm leading-relaxed outline-none focus:border-primary"
                />
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void save("draft")}
              className="cursor-pointer rounded-lg bg-violet-500 px-4 py-2 text-sm font-bold text-white hover:bg-violet-600 disabled:opacity-50"
            >
              {busy === "save-draft" ? "Saving…" : "Save Draft"}
            </button>
            <button
              type="button"
              onClick={() => setPreview((v) => !v)}
              className="cursor-pointer rounded-lg border border-border px-4 py-2 text-sm font-semibold"
            >
              {preview ? "Edit" : "Preview"}
            </button>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void save("sent")}
              className="cursor-pointer rounded-lg border border-border px-4 py-2 text-sm font-semibold disabled:opacity-50"
            >
              📤 {busy === "save-sent" ? "Distributing…" : "Distribute"}
            </button>
          </div>

          <section className="mt-8">
            <h2 className="font-bold">Your releases</h2>
            <ul className="mt-3 divide-y divide-border rounded-xl border border-border bg-surface">
              {board.releases.map((release) => (
                <li key={release.release_id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{release.headline || "(untitled draft)"}</p>
                    <p className="text-xs text-muted">
                      {release.template_label} · {release.distribution_label} ·{" "}
                      {new Date(release.updated_at).toLocaleDateString("en-IN")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                        release.status === "sent" ? "bg-emerald-500/15 text-emerald-600" : "bg-amber-500/15 text-amber-600"
                      }`}
                    >
                      {release.status}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(release.release_id);
                        setHeadline(release.headline);
                        setBody(release.body);
                        setTemplate(release.template);
                        setDistribution(release.distribution);
                        setPreview(false);
                      }}
                      className="cursor-pointer rounded-lg border border-border px-2.5 py-1 text-xs font-semibold"
                    >
                      Edit
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}

      {tab === "Media Kit" && (
        <section className="mt-6 rounded-xl border border-border bg-surface p-5">
          <h2 className="font-bold">Media Kit Generator</h2>
          <p className="mt-1 text-sm text-muted">
            Auto-pulls brand assets, stats, team bio into a {board.media_kit_format.replace(" (recommended)", "")} kit,
            stored in your platform media library.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {[
              ["Brand assets", vendor.legal_name],
              ["Releases sent", String(board.stats.releases_sent)],
              ["Output format", board.media_kit_format],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg bg-background p-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted">{label}</p>
                <p className="mt-1 truncate text-sm font-semibold">{value}</p>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setMessage(`Media kit (${board.media_kit_format}) queued — it will appear in your media library.`)}
            className="mt-4 cursor-pointer rounded-lg bg-violet-500 px-4 py-2 text-sm font-bold text-white hover:bg-violet-600"
          >
            Generate Media Kit
          </button>
        </section>
      )}

      {tab === "Influencers" && (
        <section className="mt-6 rounded-xl border border-border bg-surface p-5">
          <h2 className="font-bold">Influencer Brief Templates</h2>
          <p className="mt-1 text-sm text-muted">Structured briefs for UGC, review and unboxing campaigns.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {["UGC Campaign Brief", "Product Review Brief", "Unboxing Campaign Brief"].map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setMessage(`${item} copied into a new press release draft.`)}
                className="cursor-pointer rounded-lg border border-border bg-background p-4 text-left"
              >
                <p className="text-sm font-semibold">{item}</p>
                <p className="mt-1 text-xs text-muted">Template · ready to customise</p>
              </button>
            ))}
          </div>
        </section>
      )}

      {tab === "Coverage" && (
        <section className="mt-6 rounded-xl border border-border bg-surface p-5">
          <h2 className="font-bold">
            Coverage Tracker{" "}
            <span className="ml-1 rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-bold text-violet-600">Soon</span>
          </h2>
          <p className="mt-1 text-sm text-muted">
            PR Mention Tracker (web scraping + Google Alerts for brand mentions) ships in the next
            version — it is going through Approve Versions now, so this module stays off until your
            platform admin enables it.
          </p>
          <ul className="mt-4 space-y-2">
            {board.releases
              .filter((r) => r.status === "sent")
              .map((release) => (
                <li key={release.release_id} className="rounded-lg bg-background px-3 py-2 text-sm">
                  📰 {release.headline}
                  <span className="ml-2 text-xs text-muted">distributed via {release.distribution_label}</span>
                </li>
              ))}
          </ul>
        </section>
      )}
    </div>
  );
}
