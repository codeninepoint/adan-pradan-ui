"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { useVendorPortal } from "@/components/vendor/portal";
import { ApiError, marketplaceApi, SalesBoard } from "@/lib/api";

const TABS = ["Kanban Board", "Revenue Forecast", "Lead Capture", "Affiliates"];
const STAGE_DOT = ["bg-amber-500", "bg-sky-500", "bg-violet-500", "bg-amber-400", "bg-emerald-500"];

const inputClass =
  "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary";

function inr(value: number): string {
  if (value >= 100000) return `₹${(value / 100000).toFixed(value % 100000 === 0 ? 0 : 1)}L`;
  if (value >= 1000) return `₹${Math.round(value / 1000)}k`;
  return `₹${value.toLocaleString("en-IN")}`;
}

export default function VendorSalesPipelinePage() {
  const { vendor } = useVendorPortal();
  const { ensureAccessToken } = useAuth();
  const [board, setBoard] = useState<SalesBoard | null>(null);
  const [notImported, setNotImported] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [tab, setTab] = useState("Kanban Board");
  const [busy, setBusy] = useState<string | null>(null);
  const [showAddDeal, setShowAddDeal] = useState(false);
  const [company, setCompany] = useState("");
  const [contact, setContact] = useState("");
  const [value, setValue] = useState("");
  const [followTitle, setFollowTitle] = useState("");

  const load = useCallback(async () => {
    if (!vendor) return;
    try {
      setBoard(await marketplaceApi.salesPipelineBoard(vendor.vendor_id, ensureAccessToken));
      setNotImported(false);
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
      setError(err instanceof ApiError ? err.detail : "Could not load your sales pipeline."),
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
        <h1 className="text-xl font-bold">Sales Pipeline is not imported yet</h1>
        <p className="mt-2 text-sm text-muted">
          Import the free Standard Plugin from the Plugin Store — the 4-step wizard takes under a
          minute, and your Kanban board appears here.
        </p>
        <Link
          href="/app/vendor/plugin-store"
          className="mt-4 inline-block rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-white hover:bg-amber-600"
        >
          Go to Plugin Store
        </Link>
      </div>
    );
  }

  if (!board) return <p className="text-sm text-muted">Loading your pipeline…</p>;

  const pendingFollowups = board.followups.filter((item) => item.status !== "done");

  return (
    <div>
      <p className="text-xs text-muted">
        <Link href="/app/vendor/plugin-store" className="hover:underline">Plugin Store</Link>
        <span className="mx-1">/</span>
        <span className="font-semibold text-foreground">Sales Pipeline</span>
      </p>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">📊 Sales Pipeline</h1>
          <p className="mt-1 text-xs text-muted">
            {board.active_modules} active modules · Last updated{" "}
            {board.updated_at ? new Date(board.updated_at).toLocaleString("en-IN") : "just now"}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/app/vendor/plugin-settings" className="rounded-lg border border-border px-3 py-2 text-sm font-semibold">
            ⚙ Settings
          </Link>
          <button
            type="button"
            onClick={() => setShowAddDeal((v) => !v)}
            className="cursor-pointer rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-white hover:bg-amber-600"
          >
            + Add Deal
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

      {showAddDeal && (
        <form
          className="mt-4 grid gap-3 rounded-xl border border-border bg-surface p-4 sm:grid-cols-4"
          onSubmit={(event) => {
            event.preventDefault();
            void run("add-deal", async () => {
              await marketplaceApi.createSalesDeal(
                vendor.vendor_id,
                { company, contact_name: contact, value_inr: Number(value) || 0 },
                ensureAccessToken,
              );
              setCompany("");
              setContact("");
              setValue("");
              setShowAddDeal(false);
              setMessage("Deal added to New Lead.");
            });
          }}
        >
          <label className="text-xs font-semibold text-muted">
            Company / deal *
            <input required value={company} onChange={(e) => setCompany(e.target.value)} className={inputClass} />
          </label>
          <label className="text-xs font-semibold text-muted">
            Contact / segment
            <input value={contact} onChange={(e) => setContact(e.target.value)} className={inputClass} />
          </label>
          <label className="text-xs font-semibold text-muted">
            Value (₹)
            <input type="number" min={0} value={value} onChange={(e) => setValue(e.target.value)} className={inputClass} />
          </label>
          <div className="flex items-end">
            <button type="submit" disabled={busy !== null} className="w-full cursor-pointer rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50">
              {busy === "add-deal" ? "Adding…" : "Add Deal"}
            </button>
          </div>
        </form>
      )}

      {tab !== "Kanban Board" ? (
        <div className="mt-6 rounded-xl border border-border bg-surface p-6">
          <h2 className="font-bold">{tab}</h2>
          <p className="mt-2 text-sm text-muted">
            {tab === "Revenue Forecast" &&
              `Weighted pipeline: ${inr(board.stats.closing_this_month_inr)} in Proposal/Negotiation expected to close, across ${board.stats.deals_open} open deals.`}
            {tab === "Lead Capture" &&
              "Lead Capture & Scoring is enabled in Plugin Settings. New deals you add land in the first Kanban stage and can be moved as they progress."}
            {tab === "Affiliates" &&
              "Affiliate Manager terms were accepted during import. Partner referral tracking runs on the modules you enabled in Plugin Settings."}
          </p>
          <button type="button" onClick={() => setTab("Kanban Board")} className="mt-4 cursor-pointer text-sm font-semibold text-primary hover:underline">
            ← Back to Kanban Board
          </button>
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-border bg-surface p-4">
              <p className="text-2xl font-bold text-amber-500">{inr(board.stats.total_pipeline_inr)}</p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-muted">Total pipeline</p>
            </div>
            <div className="rounded-xl border border-border bg-surface p-4">
              <p className="text-2xl font-bold">{board.stats.deals_open}</p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-muted">Deals open</p>
            </div>
            <div className="rounded-xl border border-border bg-surface p-4">
              <p className="text-2xl font-bold text-sky-500">{inr(board.stats.closing_this_month_inr)}</p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-muted">Closing this month</p>
            </div>
            <div className="rounded-xl border border-border bg-surface p-4">
              <p className="text-2xl font-bold text-violet-500">{board.stats.avg_cycle_days}d</p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-muted">Avg. cycle</p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-3 xl:grid-cols-5">
            {board.stages.map((stage, stageIndex) => {
              const deals = board.deals.filter((deal) => deal.stage === stage.key);
              return (
                <section key={stage.key} className="rounded-xl border border-border bg-surface/60 p-3">
                  <header className="flex items-center justify-between px-1">
                    <h2 className="flex items-center gap-1.5 text-xs font-bold">
                      <span className={`h-2 w-2 rounded-full ${STAGE_DOT[stageIndex % STAGE_DOT.length]}`} />
                      {stage.label}
                      {stageIndex === board.stages.length - 1 && " ✓"}
                    </h2>
                    <span className="rounded-full bg-background px-1.5 text-[10px] font-bold text-muted">{deals.length}</span>
                  </header>
                  <div className="mt-3 space-y-2">
                    {deals.length === 0 && <p className="px-1 py-3 text-[11px] text-muted">No deals here yet.</p>}
                    {deals.map((deal) => (
                      <article key={deal.deal_id} className="rounded-lg border border-border bg-surface p-3">
                        <p className="text-sm font-semibold">{deal.company}</p>
                        {deal.contact_name && <p className="text-[11px] text-muted">{deal.contact_name}</p>}
                        <p className="mt-1 text-sm font-bold text-amber-500">{inr(deal.value_inr)}</p>
                        <div className="mt-2 flex gap-1">
                          {stageIndex > 0 && (
                            <button
                              type="button"
                              aria-label={`Move ${deal.company} back`}
                              disabled={busy !== null}
                              onClick={() =>
                                void run(`move-${deal.deal_id}`, async () => {
                                  await marketplaceApi.updateSalesDeal(
                                    vendor.vendor_id,
                                    deal.deal_id,
                                    { stage: board.stages[stageIndex - 1].key },
                                    ensureAccessToken,
                                  );
                                })
                              }
                              className="cursor-pointer rounded border border-border px-1.5 py-0.5 text-[10px] disabled:opacity-50"
                            >
                              ←
                            </button>
                          )}
                          {stageIndex < board.stages.length - 1 && (
                            <button
                              type="button"
                              aria-label={`Move ${deal.company} forward`}
                              disabled={busy !== null}
                              onClick={() =>
                                void run(`move-${deal.deal_id}`, async () => {
                                  await marketplaceApi.updateSalesDeal(
                                    vendor.vendor_id,
                                    deal.deal_id,
                                    { stage: board.stages[stageIndex + 1].key },
                                    ensureAccessToken,
                                  );
                                })
                              }
                              className="cursor-pointer rounded border border-border px-1.5 py-0.5 text-[10px] disabled:opacity-50"
                            >
                              →
                            </button>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>

          <section className="mt-6 rounded-xl border border-border bg-surface p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold">📌 Today&apos;s Follow-ups</h2>
              <span className="text-xs text-muted">{pendingFollowups.length} due</span>
            </div>
            <ul className="mt-3 divide-y divide-border">
              {board.followups.map((item) => (
                <li key={item.followup_id} className="flex items-center justify-between gap-3 py-2.5">
                  <div>
                    <p className={`text-sm font-medium ${item.status === "done" ? "text-muted line-through" : ""}`}>{item.title}</p>
                    {item.detail && <p className="text-xs text-muted">{item.detail}</p>}
                  </div>
                  {item.status === "done" ? (
                    <span className="text-xs font-bold text-emerald-600">Done ✓</span>
                  ) : (
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() =>
                        void run(`fu-${item.followup_id}`, async () => {
                          await marketplaceApi.completeSalesFollowUp(vendor.vendor_id, item.followup_id, ensureAccessToken);
                        })
                      }
                      className="cursor-pointer rounded-lg border border-border px-3 py-1 text-xs font-semibold disabled:opacity-50"
                    >
                      Done
                    </button>
                  )}
                </li>
              ))}
            </ul>
            <form
              className="mt-3 flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                if (!followTitle.trim()) return;
                void run("add-fu", async () => {
                  await marketplaceApi.createSalesFollowUp(vendor.vendor_id, { title: followTitle }, ensureAccessToken);
                  setFollowTitle("");
                });
              }}
            >
              <input
                value={followTitle}
                onChange={(e) => setFollowTitle(e.target.value)}
                placeholder="Add a follow-up…"
                aria-label="New follow-up"
                className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
              <button type="submit" disabled={busy !== null} className="cursor-pointer rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50">
                Add
              </button>
            </form>
          </section>
        </>
      )}
    </div>
  );
}
