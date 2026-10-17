"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { useVendorPortal } from "@/components/vendor/portal";
import { ApiError, marketplaceApi } from "@/lib/api";

type Review = {
  id: string;
  customer_name: string;
  product_name: string;
  rating: number;
  comment: string;
  created_at: string;
};

export default function VendorReviewsPage() {
  const { vendor } = useVendorPortal();
  const { ensureAccessToken } = useAuth();
  const [rows, setRows] = useState<Review[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!vendor) return;
    const vendorId = vendor.vendor_id;
    let cancelled = false;
    void marketplaceApi
      .vendorReviews(vendorId, ensureAccessToken)
      .then((data) => {
        if (!cancelled) setRows(data.reviews);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof ApiError ? err.detail : "Could not load reviews.");
      });
    return () => {
      cancelled = true;
    };
  }, [vendor, ensureAccessToken]);

  const totalReviews = rows.length;
  const averageRating = useMemo(() => {
    if (totalReviews === 0) return 0;
    const sum = rows.reduce((acc, row) => acc + row.rating, 0);
    return Math.round((sum / totalReviews) * 10) / 10;
  }, [rows, totalReviews]);
  const fourPlusRate = useMemo(() => {
    if (totalReviews === 0) return 0;
    const fourPlus = rows.filter((row) => row.rating >= 4).length;
    return Math.round((100 * fourPlus) / totalReviews);
  }, [rows, totalReviews]);

  if (!vendor) return null;

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Reviews</h1>
      <p className="mt-1 text-sm text-muted">Customer feedback on your products.</p>
      {error && <p className="mt-4 text-sm text-error">{error}</p>}

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <StatCard label="Average rating" value={averageRating.toFixed(1)} />
        <StatCard label="Total reviews" value={String(totalReviews)} />
        <StatCard label="4★+ reviews" value={`${fourPlusRate}%`} />
      </div>

      <div className="mt-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Latest reviews</h2>
        {rows.length === 0 ? (
          <p className="mt-4 text-sm text-muted">No reviews are on file.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {rows.map((row) => (
              <div
                key={row.id}
                className="rounded-xl border border-border bg-surface p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold">
                    {row.customer_name} · {row.product_name}
                  </p>
                  <span className="shrink-0 rounded-full border border-success/40 bg-success/10 px-2.5 py-0.5 text-xs font-bold text-success">
                    ★ {row.rating.toFixed(1)}
                  </span>
                </div>
                {row.comment ? (
                  <p className="mt-2 text-sm text-muted">{row.comment}</p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-2xl font-bold">{value}</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
    </div>
  );
}
