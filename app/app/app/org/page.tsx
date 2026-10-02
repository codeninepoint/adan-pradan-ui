"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { RequireAuth } from "@/components/auth-guards";
import { useAuth } from "@/components/auth-provider";
import { ApiError, orgApi, type OrgRegisterResponse } from "@/lib/api";
import { setSessionTenantId } from "@/lib/session";

const POLL_INTERVAL_MS = 800;
const POLL_MAX_ATTEMPTS = 20;

async function pollRegistration(
  requestId: string,
  ensureAccessToken: (force?: boolean) => Promise<string | null>,
  onTick: (status: OrgRegisterResponse) => void,
): Promise<OrgRegisterResponse> {
  let last: OrgRegisterResponse | null = null;
  for (let i = 0; i < POLL_MAX_ATTEMPTS; i++) {
    last = await orgApi.getRegistration(requestId, ensureAccessToken);
    onTick(last);
    if (last.status === "completed" || last.status === "failed") {
      return last;
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  return last ?? { request_id: requestId, status: "processing", org_id: "", estimated_ms: 0 };
}

function OrgUpgradeBody() {
  const { profile, ensureAccessToken, refreshProfile } = useAuth();
  const org = profile?.organizations[0];
  const alreadyOrg = org?.org_type === "organization";
  const keepsVendor = !alreadyOrg && org?.participation === "consumer_and_vendor";

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [contactName, setContactName] = useState(profile?.display_name ?? "");
  const [contactEmail, setContactEmail] = useState(profile?.email ?? "");
  const [country, setCountry] = useState("IN");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [pollStatus, setPollStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setResult(null);
    setPollStatus("Submitting…");
    try {
      const res = await orgApi.register(
        {
          name: name.trim(),
          slug: slug.trim().toLowerCase(),
          contact_name: contactName.trim(),
          contact_email: contactEmail.trim(),
          country: country.trim().toUpperCase(),
        },
        ensureAccessToken,
      );
      setPollStatus(`Request ${res.request_id.slice(0, 8)}… · ${res.status}`);

      const final =
        res.status === "completed" || res.status === "failed"
          ? res
          : await pollRegistration(res.request_id, ensureAccessToken, (tick) => {
              setPollStatus(`Polling… ${tick.status}`);
            });

      if (final.status === "failed") {
        setError(final.error_message || "Organization upgrade failed.");
        setResult(null);
        return;
      }

      const me = await refreshProfile();
      const preferred = me?.tenants.find(
        (t) => t.slug === `${final.keycloak_realm_ref}-default`,
      );
      if (preferred) setSessionTenantId(preferred.tenant_id);
      setResult(
        `Upgraded. Realm: ${final.keycloak_realm_ref ?? "—"}${
          final.realm_url ? ` · ${final.realm_url}` : ""
        }`,
      );
      setPollStatus(`Status: ${final.status}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Upgrade failed.");
      setPollStatus(null);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex-1 bg-background text-foreground">
      <main className="mx-auto max-w-xl px-4 py-10 sm:px-6">
        <p className="text-xs font-bold uppercase tracking-wider text-primary">Organization</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight">Upgrade to organization</h1>
        <p className="mt-2 text-sm text-muted">
          Provisions a dedicated Keycloak realm (fake in local) and a default org tenant. Status is
          polled until complete.
        </p>

        {alreadyOrg ? (
          <p className="mt-8 rounded-lg border border-border bg-surface px-4 py-3 text-sm">
            Already an organization ({org?.name}
            {org?.keycloak_realm_ref ? ` · ${org.keycloak_realm_ref}` : ""}).
          </p>
        ) : (
          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            {keepsVendor && (
              <p className="rounded-lg border border-border bg-surface px-4 py-3 text-sm">
                You are already a vendor. Upgrading keeps that vendor profile.
              </p>
            )}
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Company name"
              disabled={submitting}
              className="w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-primary disabled:opacity-60"
            />
            <input
              required
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="slug (e.g. acme-corp)"
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              disabled={submitting}
              className="w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-primary disabled:opacity-60"
            />
            <input
              required
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="Contact name"
              disabled={submitting}
              className="w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-primary disabled:opacity-60"
            />
            <input
              required
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="Contact email"
              disabled={submitting}
              className="w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-primary disabled:opacity-60"
            />
            <input
              required
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="Country code"
              disabled={submitting}
              className="w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-primary disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
            >
              {submitting ? "Upgrading…" : "Submit upgrade"}
            </button>
          </form>
        )}

        {pollStatus && (
          <p className="mt-4 text-sm text-muted" aria-live="polite">
            {pollStatus}
          </p>
        )}
        {error && (
          <p className="mt-4 rounded-lg border border-error/30 bg-error/5 px-3 py-2 text-sm text-error">
            {error}
          </p>
        )}
        {result && (
          <p className="mt-4 rounded-lg border border-border bg-surface px-3 py-2 text-sm">{result}</p>
        )}

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/app" className="text-sm font-semibold text-primary hover:underline">
            ← Dashboard
          </Link>
          <Link href="/app/vendor" className="text-sm font-semibold text-primary hover:underline">
            Vendor →
          </Link>
        </div>
      </main>
    </div>
  );
}

export default function OrgUpgradePage() {
  return (
    <RequireAuth>
      <OrgUpgradeBody />
    </RequireAuth>
  );
}
