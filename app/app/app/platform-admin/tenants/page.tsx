"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { ApiError, platformAdminApi } from "@/lib/api";

type Tenant = {
  tenant_id: string;
  tenant_name: string;
  org_name: string;
  org_type: string;
  member_count: number;
  status: string;
};

const btn =
  "cursor-pointer rounded-lg border border-border bg-background px-2 py-1 text-[11px] font-semibold hover:border-primary disabled:opacity-50";

const btnPrimary =
  "cursor-pointer rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-50";

export default function TenantsPage() {
  const { ensureAccessToken } = useAuth();
  const [items, setItems] = useState<Tenant[]>([]);
  const [stats, setStats] = useState({
    active: 0,
    suspended: 0,
    total: 0,
    individual: 0,
    organisation: 0,
    vendor: 0,
  });
  const [q, setQ] = useState("");
  const [orgType, setOrgType] = useState("all");
  const [provisionEmail, setProvisionEmail] = useState("");
  const [provisionOrg, setProvisionOrg] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [tenantData, tenantStats] = await Promise.all([
      platformAdminApi.tenants(ensureAccessToken, {
        q: q.trim() || undefined,
        org_type: orgType === "all" ? undefined : orgType,
      }),
      platformAdminApi.tenantStats(ensureAccessToken),
    ]);
    setItems(tenantData.items);
    setStats(tenantStats);
  }, [ensureAccessToken, q, orgType]);

  useEffect(() => {
    void load().catch((err: unknown) => {
      setError(err instanceof ApiError ? err.detail : "Could not load tenants.");
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
      <h1 className="text-2xl font-extrabold tracking-tight">Tenants</h1>
      <p className="mt-1 text-sm text-muted">Tenant organisations across the platform.</p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          ["Individual", stats.individual],
          ["Organisation", stats.organisation],
          ["Vendor", stats.vendor],
          ["Active", stats.active],
          ["Suspended", stats.suspended],
          ["Total", stats.total],
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
          placeholder="Search tenant or org…"
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
        <select
          value={orgType}
          onChange={(e) => setOrgType(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="all">All org types</option>
          <option value="individual">Individual</option>
          <option value="organisation">Organisation</option>
          <option value="vendor">Vendor</option>
        </select>
      </div>

      <section className="mt-6 rounded-xl border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold">Provision tenant</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            value={provisionEmail}
            onChange={(e) => setProvisionEmail(e.target.value)}
            placeholder="Owner email"
            type="email"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <input
            value={provisionOrg}
            onChange={(e) => setProvisionOrg(e.target.value)}
            placeholder="Org name (optional)"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <button
            type="button"
            className={btnPrimary}
            disabled={busy !== null || !provisionEmail.trim()}
            onClick={() =>
              void act(
                "provision",
                () =>
                  platformAdminApi.provisionTenant(
                    {
                      email: provisionEmail.trim(),
                      org_name: provisionOrg.trim() || undefined,
                    },
                    ensureAccessToken,
                  ),
                "Tenant provisioned.",
              )
            }
          >
            Provision
          </button>
        </div>
      </section>

      {message && <p className="mt-4 text-sm text-primary">{message}</p>}
      {error && <p className="mt-4 text-sm text-error">{error}</p>}

      <div className="mt-4 overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-surface text-xs uppercase text-muted">
              <th className="px-3 py-2">Tenant</th>
              <th className="px-3 py-2">Org</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Members</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-muted">
                  No tenants match.
                </td>
              </tr>
            )}
            {items.map((tenant) => (
              <tr key={tenant.tenant_id} className="border-b border-border/60">
                <td className="px-3 py-2 font-medium">{tenant.tenant_name}</td>
                <td className="px-3 py-2 text-muted">{tenant.org_name}</td>
                <td className="px-3 py-2">{tenant.org_type}</td>
                <td className="px-3 py-2">{tenant.member_count}</td>
                <td className="px-3 py-2">{tenant.status}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {tenant.status !== "suspended" && (
                      <button
                        type="button"
                        className={btn}
                        disabled={busy !== null}
                        onClick={() =>
                          void act(
                            `s-${tenant.tenant_id}`,
                            () => platformAdminApi.suspendTenant(tenant.tenant_id, ensureAccessToken),
                            "Tenant suspended.",
                          )
                        }
                      >
                        Suspend
                      </button>
                    )}
                    {tenant.status === "suspended" && (
                      <button
                        type="button"
                        className={btn}
                        disabled={busy !== null}
                        onClick={() =>
                          void act(
                            `r-${tenant.tenant_id}`,
                            () => platformAdminApi.reinstateTenant(tenant.tenant_id, ensureAccessToken),
                            "Tenant reinstated.",
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
