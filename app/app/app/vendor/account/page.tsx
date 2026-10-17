"use client";

import Link from "next/link";
import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { useVendorPortal } from "@/components/vendor/portal";
import {
  ApiError,
  serviceAccountsApi,
  vendorApi,
  type CreateServiceAccountResponse,
  type MeResponse,
  type ServiceAccountItem,
} from "@/lib/api";

export default function VendorAccountPage() {
  const { vendor } = useVendorPortal();
  const { profile, tenantId, ensureAccessToken, refreshProfile } = useAuth();
  const [me, setMe] = useState<MeResponse | null>(profile);
  const [verification, setVerification] = useState<{
    status: string;
    submitted_at: string;
    verification_status?: string | null;
  } | null>(null);
  const [items, setItems] = useState<ServiceAccountItem[]>([]);
  const [saName, setSaName] = useState("svc-webhook-receiver");
  const [saDescription, setSaDescription] = useState("");
  const [createdKey, setCreatedKey] = useState<CreateServiceAccountResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setMe(profile);
  }, [profile]);

  useEffect(() => {
    let cancelled = false;
    void refreshProfile().then((data) => {
      if (!cancelled && data) setMe(data);
    });
    return () => {
      cancelled = true;
    };
  }, [refreshProfile]);

  useEffect(() => {
    if (!vendor) return;
    let cancelled = false;
    void vendorApi
      .verification(vendor.vendor_id, ensureAccessToken)
      .then((data) => {
        if (!cancelled) setVerification(data);
      })
      .catch(() => {
        if (!cancelled) setVerification(null);
      });
    return () => {
      cancelled = true;
    };
  }, [vendor, ensureAccessToken]);

  const loadSa = useCallback(async () => {
    if (!tenantId) return;
    try {
      const data = await serviceAccountsApi.list(tenantId, ensureAccessToken);
      setItems(data.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Could not load service accounts.");
    }
  }, [tenantId, ensureAccessToken]);

  useEffect(() => {
    void loadSa();
  }, [loadSa]);

  const org = me?.organizations?.[0];
  const role = org?.membership_role ?? "";
  const vendorRole =
    role === "owner" || role === "admin"
      ? "Vendor Admin"
      : role
        ? role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
        : "Member";

  const participation = (org?.participation ?? "").toLowerCase();
  const isVendor =
    Boolean(vendor) ||
    participation.includes("vendor") ||
    participation === "consumer_and_vendor";
  const isOrg =
    org?.org_type === "organization" || isVendor || Boolean(org && org.org_type !== "individual");
  const hasIndividual = Boolean(org);

  const currentTier = isVendor ? "Vendor" : isOrg ? "Organisation" : "Individual";
  const tenantName = vendor?.legal_name || org?.name || me?.tenants?.[0]?.name || "—";

  const kycLabel = useMemo(() => {
    const status = (verification?.status || vendor?.status || "").toLowerCase();
    if (status === "verified") {
      const when = verification?.submitted_at
        ? formatDate(verification.submitted_at)
        : null;
      return { badge: "Verified", detail: when ? `Verified ${when}` : "Verified", ok: true };
    }
    if (status === "pending_verification" || status === "queued" || status === "pending") {
      return { badge: "Pending", detail: "Awaiting review", ok: false };
    }
    if (status === "rejected") {
      return { badge: "Rejected", detail: "Resubmit required", ok: false };
    }
    return { badge: "Unknown", detail: "", ok: false };
  }, [verification, vendor]);

  const initials = initialsFrom(me?.display_name || me?.email || "U");

  async function onCreateSa(e: FormEvent) {
    e.preventDefault();
    if (!tenantId) return;
    setBusy(true);
    setError(null);
    setCreatedKey(null);
    try {
      const res = await serviceAccountsApi.create(
        tenantId,
        {
          name: saName.trim(),
          description: saDescription.trim() || undefined,
          initial_role: "resource-admin",
        },
        ensureAccessToken,
      );
      setCreatedKey(res);
      await loadSa();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Create failed.");
    } finally {
      setBusy(false);
    }
  }

  async function onRotate(saId: string) {
    if (!tenantId) return;
    setError(null);
    setBusy(true);
    try {
      const res = await serviceAccountsApi.rotate(tenantId, saId, "UI rotation", ensureAccessToken);
      setCreatedKey({
        service_account_id: saId,
        principal_id: "",
        name: "",
        api_key: res.new_api_key,
        key_prefix: res.new_key_prefix,
        key_id: res.new_key_id,
        status: "active",
      });
      await loadSa();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Rotate failed.");
    } finally {
      setBusy(false);
    }
  }

  if (!vendor) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Account & Identity</h1>
        <p className="mt-1 text-sm text-muted">
          Your account type, credentials, service accounts, and tenant upgrade path.
        </p>
      </div>

      {error && <p className="text-sm text-error">{error}</p>}

      {/* Your Account */}
      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Your Account</h2>
        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/20 text-sm font-bold text-primary">
              {initials}
            </div>
            <div>
              <p className="font-semibold">{me?.display_name || "—"}</p>
              <p className="text-sm text-muted">{me?.email || "—"}</p>
            </div>
          </div>
          <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">
            User Account
          </span>
        </div>

        <dl className="mt-5 space-y-3 text-sm">
          <Kv label="Account type">
            <Badge tone="info">User Account</Badge>
            <span className="ml-2 text-muted">
              Primary login: email + password · MFA available
            </span>
          </Kv>
          <Kv label="Vendor role">
            <Badge tone="warn">{vendorRole}</Badge>
          </Kv>
          <Kv label="Tenant">
            <span>{tenantName}</span>
            {isVendor ? (
              <span className="ml-2">
                <Badge tone="accent">Vendor</Badge>
              </span>
            ) : null}
          </Kv>
          <Kv label="KYC status">
            <Badge tone={kycLabel.ok ? "success" : "muted"}>{kycLabel.badge}</Badge>
            {kycLabel.detail ? (
              <span className="ml-2 text-muted">{kycLabel.detail}</span>
            ) : null}
          </Kv>
          <Kv label="MFA">
            <Badge tone={me?.mfa_enabled ? "success" : "muted"}>
              {me?.mfa_enabled ? "Enabled" : "Not enabled"}
            </Badge>
          </Kv>
          <Kv label="Last login">
            <span className="text-muted">
              {me?.last_login_at ? formatDateTime(me.last_login_at) : "—"}
            </span>
          </Kv>
        </dl>

        <div className="mt-5">
          <Link
            href="/forgot-password"
            className="text-sm font-semibold text-primary hover:underline"
          >
            Change password
          </Link>
        </div>
      </section>

      {/* Service Accounts */}
      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Service Accounts
        </h2>
        <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-muted">
          Service Accounts are non-human identities that authenticate via API Key + HMAC-SHA256.
          Used for webhook receivers, automation scripts, and third-party integrations.{" "}
          <strong className="text-foreground">Keys rotate every 90 days.</strong>
        </div>

        {createdKey && (
          <div className="mt-4 rounded-lg border border-border bg-background px-4 py-3 text-sm">
            <p className="font-semibold">Copy this API key now — it won&apos;t be shown again.</p>
            <code className="mt-2 block break-all font-mono text-xs">{createdKey.api_key}</code>
          </div>
        )}

        <div className="mt-4 overflow-x-auto">
          {items.length === 0 ? (
            <p className="text-sm text-muted">No service accounts yet.</p>
          ) : (
            <table className="w-full min-w-[48rem] text-left text-sm">
              <thead className="text-xs font-semibold uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-2 py-2">Name</th>
                  <th className="px-2 py-2">Account type</th>
                  <th className="px-2 py-2">API key (masked)</th>
                  <th className="px-2 py-2">Last used</th>
                  <th className="px-2 py-2">Key expires</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {items.map((sa) => (
                  <tr key={sa.service_account_id} className="border-t border-border">
                    <td className="px-2 py-3 font-semibold">{sa.name}</td>
                    <td className="px-2 py-3">
                      <Badge tone="info">Service Account</Badge>
                    </td>
                    <td className="px-2 py-3 font-mono text-xs text-muted">
                      {maskKey(sa.key_prefix)}
                    </td>
                    <td className="px-2 py-3 text-muted">
                      {sa.last_used_at ? relativeTime(sa.last_used_at) : "Never"}
                    </td>
                    <td className="px-2 py-3 text-muted">
                      {sa.expires_at ? formatDate(sa.expires_at) : "—"}
                    </td>
                    <td className="px-2 py-3">
                      <Badge tone={sa.status === "active" ? "success" : "muted"}>
                        {sa.status === "active" ? "Active" : sa.status}
                      </Badge>
                    </td>
                    <td className="px-2 py-3 text-right">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void onRotate(sa.service_account_id)}
                        className="text-xs font-semibold text-primary hover:underline disabled:opacity-50"
                      >
                        Rotate key
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <form onSubmit={onCreateSa} className="mt-4 flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="text-xs font-semibold text-muted">Name</span>
            <input
              required
              value={saName}
              onChange={(e) => setSaName(e.target.value)}
              className="mt-1 block w-56 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </label>
          <label className="text-sm">
            <span className="text-xs font-semibold text-muted">Description</span>
            <input
              value={saDescription}
              onChange={(e) => setSaDescription(e.target.value)}
              className="mt-1 block w-56 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </label>
          <button
            type="submit"
            disabled={busy || !tenantId}
            className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
          >
            + Create Service Account
          </button>
        </form>
      </section>

      {/* Tenant & Upgrade Path */}
      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Tenant & Upgrade Path
        </h2>
        <dl className="mt-4 space-y-3 text-sm">
          <Kv label="Tenant name">{tenantName}</Kv>
          <Kv label="Current tier">
            <Badge tone="accent">{currentTier}</Badge>
          </Kv>
          <Kv label="Upgraded from">
            <span className="text-muted">Individual → Organisation → Vendor</span>
          </Kv>
          <Kv label="Platform plan">
            <span>Standard</span>
          </Kv>
        </dl>

        <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-muted">
          Upgrade journey
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Step done={hasIndividual} current={!isOrg && !isVendor} label="Individual" />
          <StepConnector />
          <Step done={isOrg} current={isOrg && !isVendor} label="Organisation" />
          <StepConnector />
          <Step done={isVendor} current={isVendor} label="Vendor (current)" />
        </div>

        {vendor.status === "verified" ? (
          <div className="mt-4 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
            You&apos;re a fully verified vendor. You can use Platform Plugins immediately and submit
            your own plugins for Platform Admin approval.
          </div>
        ) : null}
      </section>
    </div>
  );
}

function Kv({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[10rem_1fr] sm:items-center">
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function Badge({
  children,
  tone,
}: {
  children: ReactNode;
  tone: "success" | "warn" | "info" | "accent" | "muted";
}) {
  const styles: Record<string, string> = {
    success: "border-success/40 bg-success/10 text-success",
    warn: "border-amber-500/40 bg-amber-500/15 text-amber-400",
    info: "border-primary/30 bg-primary/10 text-primary",
    accent: "border-amber-500/40 bg-amber-500/15 text-amber-300",
    muted: "border-border bg-background text-muted",
  };
  return (
    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${styles[tone]}`}>
      {children}
    </span>
  );
}

function Step({ done, current, label }: { done: boolean; current: boolean; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={
          current
            ? "flex h-8 w-8 items-center justify-center rounded-full border border-amber-500/50 bg-amber-500/20 text-xs font-bold text-amber-300"
            : done
              ? "flex h-8 w-8 items-center justify-center rounded-full border border-success/40 bg-success/15 text-xs font-bold text-success"
              : "flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background text-xs text-muted"
        }
      >
        {done && !current ? "✓" : current ? "•" : ""}
      </div>
      <span className="text-xs text-muted">{label}</span>
    </div>
  );
}

function StepConnector() {
  return <div className="mb-5 h-px w-8 bg-border sm:w-12" />;
}

function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function maskKey(prefix?: string | null): string {
  if (!prefix) return "—";
  const tail = prefix.slice(-4);
  return `ak_••••••••${tail}`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      weekday: "short",
      hour: "numeric",
      minute: "2-digit",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function relativeTime(iso: string): string {
  try {
    const then = new Date(iso).getTime();
    const diffMs = Date.now() - then;
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins} min ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return "Yesterday";
    return `${days} days ago`;
  } catch {
    return iso;
  }
}
