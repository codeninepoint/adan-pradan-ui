"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { ApiError, platformAdminApi } from "@/lib/api";

type Vendor = {
  vendor_id: string;
  legal_name: string;
  status: string;
  plugin_count: number;
  warehouse_count: number;
  kyc_status: string;
  gmv_mtd: number;
};

const btn =
  "cursor-pointer rounded-lg border border-border bg-background px-2 py-1 text-[11px] font-semibold hover:border-primary disabled:opacity-50";

export default function VendorsPage() {
  const { ensureAccessToken } = useAuth();
  const [items, setItems] = useState<Vendor[]>([]);
  const [stats, setStats] = useState({
    active: 0,
    pending_verification: 0,
    suspended: 0,
    total_plugins: 0,
  });
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [vendorData, vendorStats] = await Promise.all([
      platformAdminApi.vendors(ensureAccessToken, {
        q: q.trim() || undefined,
        status: status === "all" ? undefined : status,
      }),
      platformAdminApi.vendorStats(ensureAccessToken),
    ]);
    setItems(vendorData.results);
    setStats(vendorStats);
  }, [ensureAccessToken, q, status]);

  useEffect(() => {
    void load().catch((err: unknown) => {
      setError(err instanceof ApiError ? err.detail : "Could not load vendors.");
    });
  }, [load]);

  async function act(key: string, fn: () => Promise<unknown>, ok: string) {
    setBusy(key);
    setError(null);
    setMessage(null);
    try {
      await fn();
      setMessage(ok);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Action failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-extrabold tracking-tight">Vendors</h1>
      <p className="mt-1 text-sm text-muted">Marketplace vendor directory and lifecycle controls.</p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Active", stats.active],
          ["Pending verification", stats.pending_verification],
          ["Suspended", stats.suspended],
          ["Total plugins", stats.total_plugins],
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
          placeholder="Search vendor name…"
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="pending_verification">Pending verification</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      {message && <p className="mt-4 text-sm text-primary">{message}</p>}
      {error && <p className="mt-4 text-sm text-error">{error}</p>}

      <div className="mt-4 overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-surface text-xs uppercase text-muted">
              <th className="px-3 py-2">Vendor</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Plugins</th>
              <th className="px-3 py-2">Warehouses</th>
              <th className="px-3 py-2">KYC</th>
              <th className="px-3 py-2">GMV MTD</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-muted">
                  No vendors match.
                </td>
              </tr>
            )}
            {items.map((vendor) => (
              <tr key={vendor.vendor_id} className="border-b border-border/60">
                <td className="px-3 py-2 font-medium">{vendor.legal_name}</td>
                <td className="px-3 py-2">{vendor.status}</td>
                <td className="px-3 py-2">{vendor.plugin_count}</td>
                <td className="px-3 py-2">{vendor.warehouse_count}</td>
                <td className="px-3 py-2">{vendor.kyc_status || "—"}</td>
                <td className="px-3 py-2">{vendor.gmv_mtd.toLocaleString()}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {vendor.status !== "suspended" && (
                      <button
                        type="button"
                        className={btn}
                        disabled={busy !== null}
                        onClick={() => {
                          const reason = window.prompt("Suspension reason:");
                          if (!reason?.trim()) return;
                          void act(
                            `s-${vendor.vendor_id}`,
                            () =>
                              platformAdminApi.suspendVendor(
                                vendor.vendor_id,
                                reason.trim(),
                                ensureAccessToken,
                              ),
                            "Vendor suspended.",
                          );
                        }}
                      >
                        Suspend
                      </button>
                    )}
                    {vendor.status === "suspended" && (
                      <button
                        type="button"
                        className={btn}
                        disabled={busy !== null}
                        onClick={() =>
                          void act(
                            `r-${vendor.vendor_id}`,
                            () => platformAdminApi.reinstateVendor(vendor.vendor_id, ensureAccessToken),
                            "Vendor reinstated.",
                          )
                        }
                      >
                        Reinstate
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
