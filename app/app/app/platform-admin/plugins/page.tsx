"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { ApiError, marketplaceApi, platformAdminApi } from "@/lib/api";

type Review = {
  version_id: string;
  plugin_slug: string;
  version: string;
  status: string;
  vendor_name: string;
  claimed_by: string | null;
  risk_level?: string;
};

const btn =
  "cursor-pointer rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-50";

export default function PluginReviewPage() {
  const { ensureAccessToken } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [stats, setStats] = useState({
    pending: 0,
    in_review: 0,
    published: 0,
    rejected: 0,
    standard_plugins: 0,
  });
  const [status, setStatus] = useState("all");
  const [risk, setRisk] = useState("all");
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{
    plugin: string;
    version: string;
    status: string;
    scan_status: string;
    requested_capabilities: string[];
    sbom_url: string;
    changelog: string;
    review_notes: string;
    risk_level?: string;
  } | null>(null);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const params: { status?: string; risk?: string; q?: string } = {};
    if (status !== "all") params.status = status;
    if (risk !== "all") params.risk = risk;
    if (q.trim()) params.q = q.trim();
    const [queue, reviewStats] = await Promise.all([
      marketplaceApi.pendingReviews(ensureAccessToken, params),
      platformAdminApi.reviewStats(ensureAccessToken),
    ]);
    setReviews(queue.items);
    setStats(reviewStats);
  }, [ensureAccessToken, status, risk, q]);

  useEffect(() => {
    void load().catch((err: unknown) => {
      setError(err instanceof ApiError ? err.detail : "Could not load reviews.");
    });
  }, [load]);

  async function run(key: string, action: () => Promise<string>) {
    setBusy(key);
    setError(null);
    setMessage(null);
    try {
      setMessage(await action());
      await load();
      if (selectedId) {
        setDetail(await marketplaceApi.review(selectedId, ensureAccessToken));
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Request failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-extrabold tracking-tight">Plugin Review</h1>
      <p className="mt-1 text-sm text-muted">Vendor plugin submissions awaiting governance decisions.</p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          ["Pending", stats.pending],
          ["In Review", stats.in_review],
          ["Published", stats.published],
          ["Rejected", stats.rejected],
          ["Standard", stats.standard_plugins],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-xl border border-border bg-surface p-3">
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs text-muted">{label}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search plugin, vendor…"
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="all">Queue (pending)</option>
          <option value="pending_review">Pending review</option>
          <option value="changes_requested">Changes requested</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="published">Published</option>
        </select>
        <select
          value={risk}
          onChange={(e) => setRisk(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="all">All risk</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </div>

      {message && <p className="mt-4 text-sm text-primary">{message}</p>}
      {error && <p className="mt-4 text-sm text-error">{error}</p>}

      <div className="mt-4 overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-surface text-xs uppercase text-muted">
              <th className="px-3 py-2">Plugin</th>
              <th className="px-3 py-2">Vendor</th>
              <th className="px-3 py-2">Version</th>
              <th className="px-3 py-2">Risk</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {reviews.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-muted">
                  No submissions match.
                </td>
              </tr>
            )}
            {reviews.map((review) => (
              <tr key={review.version_id} className="border-b border-border/60">
                <td className="px-3 py-2 font-medium">{review.plugin_slug}</td>
                <td className="px-3 py-2 text-muted">{review.vendor_name}</td>
                <td className="px-3 py-2">{review.version}</td>
                <td className="px-3 py-2">{review.risk_level ?? "low"}</td>
                <td className="px-3 py-2">
                  {review.status}
                  {review.claimed_by ? " · claimed" : ""}
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    <button
                      type="button"
                      className={btn}
                      onClick={() => {
                        setSelectedId(review.version_id);
                        void marketplaceApi
                          .review(review.version_id, ensureAccessToken)
                          .then(setDetail)
                          .catch((err: unknown) =>
                            setError(err instanceof ApiError ? err.detail : "Open failed"),
                          );
                      }}
                    >
                      Open
                    </button>
                    <button
                      type="button"
                      disabled={busy !== null}
                      className={btn}
                      onClick={() =>
                        void run(`claim-${review.version_id}`, async () => {
                          await marketplaceApi.claimReview(review.version_id, ensureAccessToken);
                          return "Claimed.";
                        })
                      }
                    >
                      Claim
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {detail && selectedId && (
        <section className="mt-6 space-y-3 rounded-xl border border-border bg-surface p-5 text-sm">
          <h2 className="font-semibold">
            {detail.plugin} {detail.version}
          </h2>
          <p className="text-muted">
            {detail.status} · scan {detail.scan_status} · risk {detail.risk_level ?? "low"}
          </p>
          <p>Capabilities: {detail.requested_capabilities.join(", ") || "none"}</p>
          <p className="break-all text-muted">SBOM: {detail.sbom_url}</p>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes for reject / request changes"
            className="w-full rounded-lg border border-border bg-background px-3 py-2"
            rows={3}
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy !== null}
              className={btn}
              onClick={() =>
                void run("approve", async () => {
                  await marketplaceApi.decideVersion(selectedId, "approved", ensureAccessToken);
                  return "Approved.";
                })
              }
            >
              Approve
            </button>
            <button
              type="button"
              disabled={busy !== null}
              className={btn}
              onClick={() =>
                void run("reject", async () => {
                  await marketplaceApi.decideVersion(selectedId, "rejected", ensureAccessToken);
                  return "Rejected.";
                })
              }
            >
              Reject
            </button>
            <button
              type="button"
              disabled={busy !== null || !notes.trim()}
              className={btn}
              onClick={() =>
                void run("changes", async () => {
                  await marketplaceApi.requestChanges(selectedId, notes.trim(), ensureAccessToken);
                  setNotes("");
                  return "Changes requested.";
                })
              }
            >
              Request changes
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
