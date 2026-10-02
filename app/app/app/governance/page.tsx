"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { RequireAuth } from "@/components/auth-guards";
import { useAuth } from "@/components/auth-provider";
import { ApiError, marketplaceApi } from "@/lib/api";

type Review = {
  version_id: string;
  plugin_slug: string;
  version: string;
  status: string;
  vendor_name: string;
  claimed_by: string | null;
};

type ReviewDetail = {
  plugin: string;
  version: string;
  status: string;
  scan_status: string;
  requested_capabilities: string[];
  sbom_url: string;
  changelog: string;
  review_notes: string;
};

type VendorRow = {
  vendor_id: string;
  legal_name: string;
  status: string;
  product_count: number;
  active_installs: number;
};

const buttonClass =
  "cursor-pointer rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50";

function GovernanceBody() {
  const { profile, ensureAccessToken } = useAuth();
  const isOperator = Boolean(profile?.is_platform_operator);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [detail, setDetail] = useState<ReviewDetail | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [vendors, setVendors] = useState<VendorRow[]>([]);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isOperator) return;
    const [queue, directory] = await Promise.all([
      marketplaceApi.pendingReviews(ensureAccessToken),
      marketplaceApi.adminVendors(ensureAccessToken),
    ]);
    setReviews(queue.items);
    setVendors(directory.results);
  }, [isOperator, ensureAccessToken]);

  useEffect(() => {
    void load().catch((err: unknown) => {
      setError(err instanceof ApiError ? err.detail : "Could not load governance.");
    });
  }, [load]);

  async function run(key: string, action: () => Promise<string>) {
    setBusy(key);
    setError(null);
    setMessage(null);
    try {
      setMessage(await action());
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Request failed.");
    } finally {
      setBusy(null);
    }
  }

  async function openReview(versionId: string) {
    setSelectedId(versionId);
    setError(null);
    try {
      setDetail(await marketplaceApi.review(versionId, ensureAccessToken));
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Could not open this review.");
    }
  }

  if (!isOperator) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-bold">Governance</h1>
        <p className="mt-2 text-sm text-muted">This page is for a platform operator.</p>
        <Link href="/app" className="mt-4 inline-block font-semibold text-primary hover:underline">
          Back to app
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-bold">Governance</h1>
      <p className="mt-2 text-sm text-muted">
        Claim a plugin version, inspect its scan and capabilities, then approve, reject, or request changes. Suspending a vendor unpublishes its offerings and leaves existing installs running.
      </p>
      {message && <p className="mt-4 text-sm text-primary">{message}</p>}
      {error && <p className="mt-4 text-sm text-error">{error}</p>}

      <section className="mt-6 space-y-3 rounded-xl border border-border bg-surface p-5">
        <h2 className="font-semibold">Plugin reviews</h2>
        {reviews.length === 0 && <p className="text-sm text-muted">No versions are waiting.</p>}
        {reviews.map((review) => (
          <div key={review.version_id} className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <button type="button" className="text-left" onClick={() => void openReview(review.version_id)}>
              <span className="font-semibold">{review.plugin_slug}</span> {review.version}
              <span className="text-muted">
                {" "}
                · {review.vendor_name} · {review.status}
                {review.claimed_by ? " · claimed" : ""}
              </span>
            </button>
            <button
              type="button"
              disabled={busy !== null}
              className={buttonClass}
              onClick={() =>
                void run(`claim-${review.version_id}`, async () => {
                  await marketplaceApi.claimReview(review.version_id, ensureAccessToken);
                  return `${review.plugin_slug} ${review.version} is claimed.`;
                })
              }
            >
              {busy === `claim-${review.version_id}` ? "Claiming…" : "Claim"}
            </button>
          </div>
        ))}
      </section>

      {detail && selectedId && (
        <section className="mt-6 space-y-3 rounded-xl border border-border bg-surface p-5 text-sm">
          <h2 className="font-semibold">
            {detail.plugin} {detail.version}
          </h2>
          <p className="text-muted">
            {detail.status} · scan {detail.scan_status}
          </p>
          <p>Capabilities: {detail.requested_capabilities.join(", ") || "none"}</p>
          <p className="break-all text-muted">SBOM: {detail.sbom_url}</p>
          {detail.changelog && <p>{detail.changelog}</p>}
          {detail.review_notes && <p>Notes: {detail.review_notes}</p>}
          <label className="block text-xs font-semibold text-muted">
            Request changes
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              rows={3}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy !== null || notes.trim() === ""}
              className={buttonClass}
              onClick={() =>
                void run("changes", async () => {
                  const result = await marketplaceApi.requestChanges(selectedId, notes.trim(), ensureAccessToken);
                  setNotes("");
                  setDetail(await marketplaceApi.review(selectedId, ensureAccessToken));
                  return `${detail.plugin} is ${result.status}.`;
                })
              }
            >
              Request changes
            </button>
            <button
              type="button"
              disabled={busy !== null}
              className={buttonClass}
              onClick={() =>
                void run("approve", async () => {
                  const result = await marketplaceApi.decideVersion(selectedId, "approved", ensureAccessToken);
                  setDetail(await marketplaceApi.review(selectedId, ensureAccessToken));
                  return `${detail.plugin} is ${result.status}.`;
                })
              }
            >
              Approve
            </button>
            <button
              type="button"
              disabled={busy !== null}
              className={buttonClass}
              onClick={() =>
                void run("reject", async () => {
                  const result = await marketplaceApi.decideVersion(selectedId, "rejected", ensureAccessToken);
                  setDetail(await marketplaceApi.review(selectedId, ensureAccessToken));
                  return `${detail.plugin} is ${result.status}.`;
                })
              }
            >
              Reject
            </button>
          </div>
        </section>
      )}

      <section className="mt-6 space-y-3 rounded-xl border border-border bg-surface p-5">
        <h2 className="font-semibold">Vendors</h2>
        {vendors.length === 0 && <p className="text-sm text-muted">No vendors yet.</p>}
        {vendors.map((vendor) => (
          <div key={vendor.vendor_id} className="space-y-2 text-sm">
            <p>
              <span className="font-semibold">{vendor.legal_name}</span>
              <span className="text-muted">
                {" "}
                · {vendor.status} · {vendor.product_count} products · {vendor.active_installs} active installs
              </span>
            </p>
            {vendor.status !== "suspended" && (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={reasons[vendor.vendor_id] ?? ""}
                  onChange={(e) => setReasons((current) => ({ ...current, [vendor.vendor_id]: e.target.value }))}
                  placeholder="Reason for suspension"
                  className="min-w-64 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  disabled={busy !== null || !(reasons[vendor.vendor_id] ?? "").trim()}
                  className={buttonClass}
                  onClick={() =>
                    void run(`suspend-${vendor.vendor_id}`, async () => {
                      const result = await marketplaceApi.suspendVendor(
                        vendor.vendor_id,
                        (reasons[vendor.vendor_id] ?? "").trim(),
                        ensureAccessToken,
                      );
                      return `${vendor.legal_name} is ${result.status}. ${result.offerings_unpublished} offerings unpublished.`;
                    })
                  }
                >
                  {busy === `suspend-${vendor.vendor_id}` ? "Suspending…" : "Suspend"}
                </button>
              </div>
            )}
          </div>
        ))}
      </section>

      <Link href="/app" className="mt-8 inline-block text-sm font-semibold text-primary hover:underline">
        Back to app
      </Link>
    </main>
  );
}

export default function GovernancePage() {
  return (
    <RequireAuth>
      <GovernanceBody />
    </RequireAuth>
  );
}
