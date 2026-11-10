"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { useVendorPortal } from "@/components/vendor/portal";
import { ApiError, MarketingBoard, marketplaceApi } from "@/lib/api";

const TABS = ["Campaigns", "RACE Funnel", "Promo Codes", "Listing Boost"];
const CHANNELS = ["Instagram + Meta", "Google Ads", "Meta + Google + TikTok", "Email + WhatsApp", "Meta + YouTube", "Pinterest + FB"];

const inputClass =
  "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary";

function inr(value: number): string {
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

const STATUS_STYLES: Record<string, string> = {
  live: "bg-emerald-500/15 text-emerald-600",
  paused: "bg-amber-500/15 text-amber-600",
  draft: "bg-background text-muted",
};

export default function VendorDigitalMarketingPage() {
  const { vendor } = useVendorPortal();
  const { ensureAccessToken } = useAuth();
  const [board, setBoard] = useState<MarketingBoard | null>(null);
  const [notImported, setNotImported] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [tab, setTab] = useState("Campaigns");
  const [busy, setBusy] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState("");
  const [channel, setChannel] = useState(CHANNELS[0]);
  const [spend, setSpend] = useState("");
  const [goLive, setGoLive] = useState(true);
  const [promoCode, setPromoCode] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!vendor) return;
    try {
      setBoard(await marketplaceApi.digitalMarketingBoard(vendor.vendor_id, ensureAccessToken));
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
      setError(err instanceof ApiError ? err.detail : "Could not load digital marketing."),
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
        <h1 className="text-xl font-bold">Digital Marketing is not imported yet</h1>
        <p className="mt-2 text-sm text-muted">
          Import the free Standard Plugin from the Plugin Store — the 4-step wizard takes under a
          minute, and your campaigns dashboard appears here.
        </p>
        <Link
          href="/app/vendor/plugin-store"
          className="mt-4 inline-block rounded-lg bg-sky-500 px-4 py-2 text-sm font-bold text-white hover:bg-sky-600"
        >
          Go to Plugin Store
        </Link>
      </div>
    );
  }

  if (!board) return <p className="text-sm text-muted">Loading your campaigns…</p>;

  const maxFunnel = Math.max(1, ...board.race_funnel.map((row) => row.value));

  return (
    <div>
      <p className="text-xs text-muted">
        <Link href="/app/vendor/plugin-store" className="hover:underline">Plugin Store</Link>
        <span className="mx-1">/</span>
        <span className="font-semibold text-foreground">Digital Marketing</span>
      </p>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">📣 Digital Marketing</h1>
          <p className="mt-1 text-xs text-muted">
            {board.active_modules} active modules · RACE funnel live · Platform daily spend cap{" "}
            {inr(board.daily_spend_cap_inr)}/vendor
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/app/vendor/plugin-settings" className="rounded-lg border border-border px-3 py-2 text-sm font-semibold">
            ⚙ Settings
          </Link>
          <button
            type="button"
            onClick={() => setShowNew((v) => !v)}
            className="cursor-pointer rounded-lg bg-sky-500 px-4 py-2 text-sm font-bold text-white hover:bg-sky-600"
          >
            + New Campaign
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

      {showNew && (
        <form
          className="mt-4 grid gap-3 rounded-xl border border-border bg-surface p-4 sm:grid-cols-4"
          onSubmit={(event) => {
            event.preventDefault();
            void run("new-campaign", async () => {
              await marketplaceApi.createMarketingCampaign(
                vendor.vendor_id,
                { name, channel, spend_inr: Number(spend) || 0, status: goLive ? "live" : "draft" },
                ensureAccessToken,
              );
              setName("");
              setSpend("");
              setShowNew(false);
              setMessage("Campaign created.");
            });
          }}
        >
          <label className="text-xs font-semibold text-muted">
            Campaign name *
            <input required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          </label>
          <label className="text-xs font-semibold text-muted">
            Channel
            <select value={channel} onChange={(e) => setChannel(e.target.value)} className={inputClass}>
              {CHANNELS.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-muted">
            Spend (₹, capped at {inr(board.daily_spend_cap_inr)}/day)
            <input type="number" min={0} value={spend} onChange={(e) => setSpend(e.target.value)} className={inputClass} />
          </label>
          <div className="flex items-end gap-3 pb-2">
            <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold">
              <input type="checkbox" checked={goLive} onChange={(e) => setGoLive(e.target.checked)} />
              Go live now
            </label>
            <button type="submit" disabled={busy !== null} className="cursor-pointer rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50">
              {busy === "new-campaign" ? "Creating…" : "Create"}
            </button>
          </div>
        </form>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-2xl font-bold text-sky-500">{inr(board.stats.total_ad_spend_inr)}</p>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-muted">Total ad spend</p>
          <p className="text-[11px] text-muted">Budget: {inr(board.stats.budget_inr)}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-2xl font-bold text-emerald-500">{board.stats.avg_ctr_percent.toFixed(1)}%</p>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-muted">Avg. CTR</p>
          <p className="text-[11px] text-emerald-600">Spend-weighted across campaigns</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-2xl font-bold text-amber-500">{board.stats.conversions}</p>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-muted">Conversions</p>
          <p className="text-[11px] text-emerald-600">{board.stats.live_campaigns} campaigns live</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-2xl font-bold text-violet-500">{inr(board.stats.cost_per_conversion_inr)}</p>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-muted">Cost per conv.</p>
          <p className="text-[11px] text-muted">Spend ÷ conversions</p>
        </div>
      </div>

      {tab === "Campaigns" && (
        <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-[10px] uppercase tracking-widest text-muted">
                <th className="px-4 py-3 font-bold">Campaign</th>
                <th className="px-4 py-3 font-bold">Channel</th>
                <th className="px-4 py-3 font-bold">Spend</th>
                <th className="px-4 py-3 font-bold">CTR</th>
                <th className="px-4 py-3 font-bold">Conv.</th>
                <th className="px-4 py-3 font-bold">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {board.campaigns.map((campaign) => (
                <tr key={campaign.campaign_id}>
                  <td className="px-4 py-3 font-medium">{campaign.name}</td>
                  <td className="px-4 py-3 text-muted">{campaign.channel || "—"}</td>
                  <td className="px-4 py-3">{campaign.spend_inr ? inr(campaign.spend_inr) : "—"}</td>
                  <td className="px-4 py-3">{campaign.ctr_percent ? `${campaign.ctr_percent.toFixed(1)}%` : "—"}</td>
                  <td className="px-4 py-3">{campaign.conversions || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_STYLES[campaign.status]}`}>
                      {campaign.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {campaign.status === "live" ? (
                      <button
                        type="button"
                        disabled={busy !== null}
                        onClick={() =>
                          void run(`pause-${campaign.campaign_id}`, async () => {
                            await marketplaceApi.updateMarketingCampaign(vendor.vendor_id, campaign.campaign_id, { status: "paused" }, ensureAccessToken);
                          })
                        }
                        className="cursor-pointer rounded-lg border border-border px-2.5 py-1 text-xs font-semibold disabled:opacity-50"
                      >
                        Pause
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={busy !== null}
                        onClick={() =>
                          void run(`live-${campaign.campaign_id}`, async () => {
                            await marketplaceApi.updateMarketingCampaign(vendor.vendor_id, campaign.campaign_id, { status: "live" }, ensureAccessToken);
                          })
                        }
                        className="cursor-pointer rounded-lg border border-border px-2.5 py-1 text-xs font-semibold disabled:opacity-50"
                      >
                        {campaign.status === "paused" ? "Resume" : "Go Live"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "RACE Funnel" && (
        <section className="mt-6 rounded-xl border border-border bg-surface p-5">
          <h2 className="font-bold">RACE Funnel — Reach → Act → Convert → Engage</h2>
          <div className="mt-4 space-y-3">
            {board.race_funnel.map((row, index) => (
              <div key={row.stage}>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold">{row.stage}</span>
                  <span className="text-muted">{row.value.toLocaleString("en-IN")}</span>
                </div>
                <div className="mt-1 h-3 overflow-hidden rounded-full bg-background">
                  <div
                    className={`h-full rounded-full ${["bg-sky-500", "bg-violet-500", "bg-amber-500", "bg-emerald-500"][index % 4]}`}
                    style={{ width: `${Math.max(3, (row.value / maxFunnel) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-muted">
            Funnel is computed from your live campaign spend, CTR and conversions — no third-party
            export by default, per the platform guarantee.
          </p>
        </section>
      )}

      {tab === "Promo Codes" && (
        <section className="mt-6 rounded-xl border border-border bg-surface p-5">
          <h2 className="font-bold">Promo Codes</h2>
          <p className="mt-1 text-sm text-muted">
            Generate a code for your storefront. Platform cap: 200 active codes per vendor (set by
            your platform admin).
          </p>
          <button
            type="button"
            onClick={() =>
              setPromoCode(`ADAN${Math.random().toString(36).slice(2, 6).toUpperCase()}10`)
            }
            className="mt-4 cursor-pointer rounded-lg bg-sky-500 px-4 py-2 text-sm font-bold text-white hover:bg-sky-600"
          >
            Generate Promo Code
          </button>
          {promoCode && (
            <p className="mt-4 rounded-lg bg-background px-4 py-3 font-mono text-lg font-bold tracking-widest">
              {promoCode} <span className="ml-2 font-sans text-xs font-semibold text-emerald-600">10% off · ready to share</span>
            </p>
          )}
        </section>
      )}

      {tab === "Listing Boost" && (
        <section className="mt-6 rounded-xl border border-border bg-surface p-5">
          <h2 className="font-bold">Listing Boost</h2>
          <p className="mt-1 text-sm text-muted">
            Pay-to-rank within platform search results. Boosts run inside your platform daily spend
            cap of {inr(board.daily_spend_cap_inr)} — create a campaign above and mark it live to
            boost the linked listings.
          </p>
          <button
            type="button"
            onClick={() => setTab("Campaigns")}
            className="mt-4 cursor-pointer text-sm font-semibold text-primary hover:underline"
          >
            View campaigns →
          </button>
        </section>
      )}
    </div>
  );
}
