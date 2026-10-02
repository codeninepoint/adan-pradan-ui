"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { RequireAuth } from "@/components/auth-guards";
import { useAuth } from "@/components/auth-provider";
import { ApiError, resourcesApi, type ResourceItem } from "@/lib/api";

function DashboardBody() {
  const { profile, tenantId, session, ensureAccessToken } = useAuth();
  const org = profile?.organizations[0];
  const tenant = profile?.tenants.find((t) => t.tenant_id === tenantId) ?? profile?.tenants[0];

  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [resourceType, setResourceType] = useState("workspace");
  const [submitting, setSubmitting] = useState(false);

  const loadResources = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await resourcesApi.list(tenantId, ensureAccessToken);
      setResources(data.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Failed to load resources.");
    } finally {
      setLoading(false);
    }
  }, [tenantId, ensureAccessToken]);

  useEffect(() => {
    void loadResources();
  }, [loadResources]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!tenantId) {
      setError("No active tenant on this session.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await resourcesApi.create(
        tenantId,
        { name: name.trim(), resource_type: resourceType.trim() },
        ensureAccessToken,
      );
      setName("");
      await loadResources();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Failed to create resource.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex-1 bg-background text-foreground">
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <p className="text-xs font-bold uppercase tracking-wider text-primary">Individual workspace</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight">
          Welcome{profile?.display_name ? `, ${profile.display_name}` : ""}
        </h1>
        <p className="mt-2 text-sm text-muted">
          AuthZ-gated resources for your tenant. Calls use{" "}
          <code className="rounded bg-surface px-1.5 py-0.5 text-xs">Bearer</code> +{" "}
          <code className="rounded bg-surface px-1.5 py-0.5 text-xs">X-Tenant-Id</code>.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-surface p-5">
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Account</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div>
                <dt className="text-muted">Email</dt>
                <dd className="font-medium">{profile?.email ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted">Status</dt>
                <dd className="font-medium">{profile?.status ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted">User ID</dt>
                <dd className="break-all font-mono text-xs">{profile?.user_id ?? session?.user_id}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-xl border border-border bg-surface p-5">
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Organization</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div>
                <dt className="text-muted">Name</dt>
                <dd className="font-medium">{org?.name ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted">Type</dt>
                <dd className="font-medium">{org?.org_type ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted">Tenant</dt>
                <dd className="font-medium">
                  {tenant?.name ?? "—"}{" "}
                  <span className="font-mono text-xs text-muted">({tenantId?.slice(0, 8)}…)</span>
                </dd>
              </div>
            </dl>
          </div>
        </div>

        <section className="mt-8 rounded-xl border border-border bg-surface p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Resources</h2>
            <button
              type="button"
              onClick={() => void loadResources()}
              className="text-xs font-semibold text-primary hover:underline"
            >
              Refresh
            </button>
          </div>

          <form onSubmit={onCreate} className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Resource name"
              className="rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary"
            />
            <input
              required
              value={resourceType}
              onChange={(e) => setResourceType(e.target.value)}
              placeholder="resource_type"
              className="rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary"
            />
            <button
              type="submit"
              disabled={submitting || !tenantId}
              className="rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-60"
            >
              {submitting ? "Creating…" : "Create"}
            </button>
          </form>

          {error && (
            <p className="mt-4 rounded-lg border border-error/30 bg-error/5 px-3 py-2 text-sm text-error">
              {error}
            </p>
          )}

          <div className="mt-4 overflow-x-auto">
            {loading ? (
              <p className="text-sm text-muted">Loading resources…</p>
            ) : resources.length === 0 ? (
              <p className="text-sm text-muted">No resources yet. Create one above.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                    <th className="py-2 pr-3 font-bold">Name</th>
                    <th className="py-2 pr-3 font-bold">Type</th>
                    <th className="py-2 pr-3 font-bold">Status</th>
                    <th className="py-2 font-bold">Id</th>
                  </tr>
                </thead>
                <tbody>
                  {resources.map((r) => (
                    <tr key={r.id} className="border-b border-border/60">
                      <td className="py-2.5 pr-3 font-medium">{r.name}</td>
                      <td className="py-2.5 pr-3 text-muted">{r.resource_type}</td>
                      <td className="py-2.5 pr-3">{r.status}</td>
                      <td className="py-2.5 font-mono text-xs text-muted">{r.id.slice(0, 8)}…</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/app/members"
            className="rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover"
          >
            Members & roles →
          </Link>
          <Link
            href="/app/org"
            className="rounded-full border border-border bg-surface px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-[var(--hero-tint)]"
          >
            Org upgrade
          </Link>
          <Link
            href="/app/service-accounts"
            className="rounded-full border border-border bg-surface px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-[var(--hero-tint)]"
          >
            Service accounts
          </Link>
          <Link
            href="/app/vendor"
            className="rounded-full border border-border bg-surface px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-[var(--hero-tint)]"
          >
            Vendor
          </Link>
          <Link
            href="/"
            className="rounded-full border border-border bg-surface px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-[var(--hero-tint)]"
          >
            ← Back to home
          </Link>
        </div>
      </main>
    </div>
  );
}

export default function AppPage() {
  return (
    <RequireAuth>
      <DashboardBody />
    </RequireAuth>
  );
}
