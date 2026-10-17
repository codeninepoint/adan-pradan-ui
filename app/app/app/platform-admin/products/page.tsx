"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { ApiError, platformAdminApi } from "@/lib/api";

type Product = {
  product_id: string;
  name: string;
  vendor_name: string;
  category: string;
  status: string;
  pa_status: string;
  pa_reject_reason: string;
  fulfilment_type: string;
  submitted_at: string;
};

type Location = {
  location: string;
  warehouse_count: number;
  vendor_count: number;
  units_stored: number;
};

const TABS = ["Content Review", "All Products", "Location Map", "Vendor Coverage"] as const;
type Tab = (typeof TABS)[number];

const btn =
  "cursor-pointer rounded-lg border border-border bg-background px-2 py-1 text-[11px] font-semibold hover:border-primary disabled:opacity-50";

const btnPrimary =
  "cursor-pointer rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-50";

export default function ProductsPage() {
  const { ensureAccessToken } = useAuth();
  const [tab, setTab] = useState<Tab>("Content Review");
  const [products, setProducts] = useState<Product[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [stats, setStats] = useState({
    pending_review: 0,
    live: 0,
    rejected: 0,
    not_submitted: 0,
    warehouse_locations: 0,
  });
  const [q, setQ] = useState("");
  const [paStatus, setPaStatus] = useState("all");
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const loadProducts = useCallback(async () => {
    const params: { q?: string; pa_status?: string } = {};
    if (q.trim()) params.q = q.trim();
    if (tab === "Content Review") {
      params.pa_status = "pending_review";
    } else if (paStatus !== "all") {
      params.pa_status = paStatus;
    }
    const [productData, productStats] = await Promise.all([
      platformAdminApi.products(ensureAccessToken, params),
      platformAdminApi.productStats(ensureAccessToken),
    ]);
    setProducts(productData.items);
    setStats(productStats);
  }, [ensureAccessToken, q, paStatus, tab]);

  const loadLocations = useCallback(async () => {
    const data = await platformAdminApi.locationsSummary(ensureAccessToken);
    setLocations(data.items);
  }, [ensureAccessToken]);

  useEffect(() => {
    const load = async () => {
      if (tab === "Location Map" || tab === "Vendor Coverage") {
        await loadLocations();
      } else {
        await loadProducts();
      }
    };
    void load().catch((err: unknown) => {
      setError(err instanceof ApiError ? err.detail : "Could not load products.");
    });
  }, [tab, loadProducts, loadLocations]);

  async function act(key: string, fn: () => Promise<unknown>, ok: string) {
    setBusy(key);
    setError(null);
    setMessage(null);
    try {
      await fn();
      setMessage(ok);
      await loadProducts();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Action failed.");
    } finally {
      setBusy(null);
    }
  }

  const maxVendorCount = Math.max(...locations.map((l) => l.vendor_count), 1);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-extrabold tracking-tight">Products</h1>
      <p className="mt-1 text-sm text-muted">Product catalogue governance, review queue, and fulfilment coverage.</p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          ["Pending review", stats.pending_review],
          ["Live", stats.live],
          ["Rejected", stats.rejected],
          ["Not submitted", stats.not_submitted],
          ["Locations", stats.warehouse_locations],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-xl border border-border bg-surface p-3">
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs text-muted">{label}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              tab === t ? "bg-primary text-primary-foreground" : "bg-surface text-muted"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {(tab === "Content Review" || tab === "All Products") && (
        <div className="mt-4 flex flex-wrap gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search product or vendor…"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          {tab === "All Products" && (
            <select
              value={paStatus}
              onChange={(e) => setPaStatus(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="all">All PA statuses</option>
              <option value="pending_review">Pending review</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="not_submitted">Not submitted</option>
            </select>
          )}
        </div>
      )}

      {message && <p className="mt-4 text-sm text-primary">{message}</p>}
      {error && <p className="mt-4 text-sm text-error">{error}</p>}

      {(tab === "Content Review" || tab === "All Products") && (
        <div className="mt-4 overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-surface text-xs uppercase text-muted">
                <th className="px-3 py-2">Product</th>
                <th className="px-3 py-2">Vendor</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">PA status</th>
                <th className="px-3 py-2">Submitted</th>
                {tab === "Content Review" && <th className="px-3 py-2">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {products.length === 0 && (
                <tr>
                  <td colSpan={tab === "Content Review" ? 7 : 6} className="px-3 py-6 text-muted">
                    No products match.
                  </td>
                </tr>
              )}
              {products.map((product) => (
                <tr key={product.product_id} className="border-b border-border/60">
                  <td className="px-3 py-2 font-medium">{product.name}</td>
                  <td className="px-3 py-2 text-muted">{product.vendor_name}</td>
                  <td className="px-3 py-2">{product.category}</td>
                  <td className="px-3 py-2">{product.status}</td>
                  <td className="px-3 py-2">
                    {product.pa_status}
                    {product.pa_reject_reason ? ` · ${product.pa_reject_reason}` : ""}
                  </td>
                  <td className="px-3 py-2 text-muted">{product.submitted_at || "—"}</td>
                  {tab === "Content Review" && (
                    <td className="px-3 py-2">
                      <div className="flex flex-col gap-1">
                        <div className="flex flex-wrap gap-1">
                          <button
                            type="button"
                            className={btnPrimary}
                            disabled={busy !== null}
                            onClick={() =>
                              void act(
                                `a-${product.product_id}`,
                                () => platformAdminApi.approveProduct(product.product_id, ensureAccessToken),
                                "Product approved.",
                              )
                            }
                          >
                            Approve
                          </button>
                        </div>
                        <input
                          value={rejectReason[product.product_id] ?? ""}
                          onChange={(e) =>
                            setRejectReason((prev) => ({
                              ...prev,
                              [product.product_id]: e.target.value,
                            }))
                          }
                          placeholder="Reject reason"
                          className="rounded border border-border bg-background px-2 py-1 text-xs"
                        />
                        <button
                          type="button"
                          className={btn}
                          disabled={busy !== null || !(rejectReason[product.product_id] ?? "").trim()}
                          onClick={() =>
                            void act(
                              `r-${product.product_id}`,
                              () =>
                                platformAdminApi.rejectProduct(
                                  product.product_id,
                                  (rejectReason[product.product_id] ?? "").trim(),
                                  ensureAccessToken,
                                ),
                              "Product rejected.",
                            )
                          }
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "Location Map" && (
        <div className="mt-4 overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-surface text-xs uppercase text-muted">
                <th className="px-3 py-2">Location</th>
                <th className="px-3 py-2">Warehouses</th>
                <th className="px-3 py-2">Vendors</th>
                <th className="px-3 py-2">Units stored</th>
              </tr>
            </thead>
            <tbody>
              {locations.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-muted">
                    No location data.
                  </td>
                </tr>
              )}
              {locations.map((loc) => (
                <tr key={loc.location} className="border-b border-border/60">
                  <td className="px-3 py-2 font-medium">{loc.location}</td>
                  <td className="px-3 py-2">{loc.warehouse_count}</td>
                  <td className="px-3 py-2">{loc.vendor_count}</td>
                  <td className="px-3 py-2">{loc.units_stored.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "Vendor Coverage" && (
        <>
          <p className="mt-4 text-sm text-muted">
            Relationship flow: vendors register warehouses per location, then list products fulfilled from
            those warehouses to tenant marketplaces.
          </p>
          <div className="mt-4 overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-surface text-xs uppercase text-muted">
                  <th className="px-3 py-2">Location</th>
                  <th className="px-3 py-2">Vendor coverage</th>
                  <th className="px-3 py-2">Warehouses</th>
                  <th className="px-3 py-2">Units</th>
                </tr>
              </thead>
              <tbody>
                {locations.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-muted">
                      No coverage data.
                    </td>
                  </tr>
                )}
                {locations.map((loc) => (
                  <tr key={loc.location} className="border-b border-border/60">
                    <td className="px-3 py-2 font-medium">{loc.location}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 max-w-[160px] rounded bg-background">
                          <div
                            className="h-2 rounded bg-primary"
                            style={{ width: `${(loc.vendor_count / maxVendorCount) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted">{loc.vendor_count} vendors</span>
                      </div>
                    </td>
                    <td className="px-3 py-2">{loc.warehouse_count}</td>
                    <td className="px-3 py-2">{loc.units_stored.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}
