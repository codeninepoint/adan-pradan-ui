"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { ApiError, marketplaceApi } from "@/lib/api";

type Review = {
  version_id: string;
  plugin_slug: string;
  version: string;
  status: string;
  vendor_name: string;
  claimed_by: string | null;
  risk_level?: string;
  decided_at?: string | null;
  review_notes?: string;
};

const btn =
  "cursor-pointer rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-50";

export default function ApproveVersionsPage() {
  const { ensureAccessToken } = useAuth();
  const [tab, setTab] = useState<"pending" | "in_review" | "history">("pending");
  const [items, setItems] = useState<Review[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (tab === "pending") {
      const data = await marketplaceApi.pendingReviews(ensureAccessToken, { claimed: false });
      setItems(data.items);
    } else if (tab === "in_review") {
      const data = await marketplaceApi.pendingReviews(ensureAccessToken, { claimed: true });
      setItems(data.items);
    } else {
      const [approved, rejected] = await Promise.all([
        marketplaceApi.pendingReviews(ensureAccessToken, { status: "approved" }),
        marketplaceApi.pendingReviews(ensureAccessToken, { status: "rejected" }),
      ]);
      setItems(
        [...approved.items, ...rejected.items].sort((a, b) =>
          (b.decided_at || "").localeCompare(a.decided_at || ""),
        ),
      );
    }
  }, [ensureAccessToken, tab]);

  useEffect(() => {
    void load().catch((err: unknown) => {
      setError(err instanceof ApiError ? err.detail : "Could not load versions.");
    });
  }, [load]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-extrabold tracking-tight">Approve Versions</h1>
      <p className="mt-1 text-sm text-muted">Pending, in-review, and decision history for vendor plugins.</p>

      <div className="mt-6 flex gap-2">
        {(
          [
            ["pending", "Pending"],
            ["in_review", "In Review"],
            ["history", "History"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
              tab === id ? "bg-primary text-primary-foreground" : "bg-surface text-muted"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <p className="mt-4 text-sm text-error">{error}</p>}

      <div className="mt-4 space-y-3">
        {items.length === 0 && <p className="text-sm text-muted">Nothing in this tab.</p>}
        {items.map((item) => (
          <div
            key={item.version_id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4 text-sm"
          >
            <div>
              <p className="font-semibold">
                {item.plugin_slug} {item.version}
              </p>
              <p className="text-muted">
                {item.vendor_name} · {item.status} · risk {item.risk_level ?? "low"}
                {item.decided_at ? ` · ${item.decided_at}` : ""}
              </p>
              {item.review_notes && <p className="mt-1 text-xs text-muted">{item.review_notes}</p>}
            </div>
            {tab !== "history" && (
              <div className="flex gap-2">
                {tab === "pending" && (
                  <button
                    type="button"
                    disabled={busy !== null}
                    className={btn}
                    onClick={() => {
                      setBusy(item.version_id);
                      void marketplaceApi
                        .claimReview(item.version_id, ensureAccessToken)
                        .then(() => load())
                        .catch((err: unknown) =>
                          setError(err instanceof ApiError ? err.detail : "Claim failed"),
                        )
                        .finally(() => setBusy(null));
                    }}
                  >
                    Claim
                  </button>
                )}
                <button
                  type="button"
                  disabled={busy !== null}
                  className={btn}
                  onClick={() => {
                    setBusy(`a-${item.version_id}`);
                    void marketplaceApi
                      .decideVersion(item.version_id, "approved", ensureAccessToken)
                      .then(() => load())
                      .catch((err: unknown) =>
                        setError(err instanceof ApiError ? err.detail : "Approve failed"),
                      )
                      .finally(() => setBusy(null));
                  }}
                >
                  Approve
                </button>
                <button
                  type="button"
                  disabled={busy !== null}
                  className={btn}
                  onClick={() => {
                    setBusy(`r-${item.version_id}`);
                    void marketplaceApi
                      .decideVersion(item.version_id, "rejected", ensureAccessToken)
                      .then(() => load())
                      .catch((err: unknown) =>
                        setError(err instanceof ApiError ? err.detail : "Reject failed"),
                      )
                      .finally(() => setBusy(null));
                  }}
                >
                  Reject
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
