"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { RequireAuth } from "@/components/auth-guards";
import { useAuth } from "@/components/auth-provider";
import { ApiError, orgApi, vendorApi, type VendorEligibilityResponse } from "@/lib/api";
import { clearVendorId, saveVendorId } from "@/lib/session";

type QueueItem = {
  verification_id: string;
  vendor_id: string;
  legal_name: string;
  contact_email: string;
  org_id: string;
  status: string;
  submitted_at: string;
  business_doc_url?: string | null;
};

type VerificationInfo = {
  vendor_id: string;
  status: string;
  submitted_at: string;
  verification_id?: string | null;
  verification_status?: string | null;
  notes?: string | null;
};

function VendorBody() {
  const { profile, ensureAccessToken, refreshProfile } = useAuth();
  const org = profile?.organizations[0];
  const [eligibility, setEligibility] = useState<VendorEligibilityResponse | null>(null);
  const [verification, setVerification] = useState<VerificationInfo | null>(null);
  const [legalName, setLegalName] = useState(org?.name ?? "");
  const [taxId, setTaxId] = useState("");
  const [bank, setBank] = useState("");
  const [email, setEmail] = useState(profile?.email ?? "");
  const [docUrl, setDocUrl] = useState("https://uploads.example.com/reg.pdf");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [acceptOrgId, setAcceptOrgId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = useState<Record<string, string>>({});
  const isOperator = profile?.is_platform_operator === true;

  const loadVerification = useCallback(
    async (vendorId: string) => {
      setLoadingStatus(true);
      try {
        const data = await vendorApi.verification(vendorId, ensureAccessToken);
        setVerification(data);
      } catch (err) {
        const foreign =
          err instanceof ApiError && (err.status === 403 || err.status === 404);
        if (foreign) {
          clearVendorId();
          setVendorId(null);
          setVerification(null);
        } else {
          setError(err instanceof ApiError ? err.detail : "Failed to load verification status.");
        }
      } finally {
        setLoadingStatus(false);
      }
    },
    [ensureAccessToken],
  );

  const loadEligibility = useCallback(async () => {
    if (!org?.org_id) return;
    try {
      const data = await vendorApi.eligibility(org.org_id, ensureAccessToken);
      setEligibility(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Failed to check eligibility.");
    }
  }, [org?.org_id, ensureAccessToken]);

  const loadQueue = useCallback(async () => {
    if (!isOperator) return;
    try {
      const data = await vendorApi.listVerifications(ensureAccessToken);
      setQueue(data.items);
      setQueueError(null);
    } catch (err) {
      setQueueError(err instanceof ApiError ? err.detail : "Failed to load the review queue.");
    }
  }, [ensureAccessToken, isOperator]);

  useEffect(() => {
    void loadEligibility();
    void (async () => {
      const orgs = profile?.organizations ?? [];
      for (const candidate of orgs) {
        try {
          const found = await vendorApi.forOrg(candidate.org_id, ensureAccessToken);
          saveVendorId(found.vendor_id);
          setVendorId(found.vendor_id);
          await loadVerification(found.vendor_id);
          return;
        } catch (err) {
          if (err instanceof ApiError && (err.status === 404 || err.status === 403)) continue;
          setError(err instanceof ApiError ? err.detail : "Failed to load the vendor profile.");
          return;
        }
      }
      clearVendorId();
      setVendorId(null);
      setVerification(null);
    })();
    void loadQueue();
  }, [loadEligibility, loadVerification, loadQueue, profile?.organizations, ensureAccessToken]);

  async function onDecide(verificationId: string, decision: "approved" | "rejected") {
    setDecidingId(verificationId);
    setQueueError(null);
    try {
      const notes = rejectNotes[verificationId]?.trim();
      await vendorApi.decide(
        verificationId,
        { decision, notes: decision === "rejected" && notes ? notes : undefined },
        ensureAccessToken,
      );
      await loadQueue();
    } catch (err) {
      setQueueError(err instanceof ApiError ? err.detail : "Decision failed.");
    } finally {
      setDecidingId(null);
    }
  }

  async function onRegister(e: FormEvent) {
    e.preventDefault();
    if (!org?.org_id) return;
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const res = await vendorApi.register(
        org.org_id,
        {
          legal_name: legalName.trim(),
          tax_id: taxId.trim(),
          payout_bank_account: bank.trim(),
          contact_email: email.trim(),
          business_doc_url: docUrl.trim(),
        },
        ensureAccessToken,
      );
      saveVendorId(res.vendor_id);
      setVendorId(res.vendor_id);
      setMessage(`Registered. Vendor ${res.vendor_id.slice(0, 8)}… · ${res.status}`);
      await refreshProfile();
      await loadEligibility();
      await loadVerification(res.vendor_id);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Registration failed.");
    } finally {
      setSubmitting(false);
    }
  }

  async function onInvite(e: FormEvent) {
    e.preventDefault();
    if (!org?.org_id) return;
    setInviting(true);
    setError(null);
    setMessage(null);
    try {
      const res = await orgApi.inviteMember(
        org.org_id,
        { email: inviteEmail.trim(), org_role: "member" },
        ensureAccessToken,
      );
      setMessage(`Invited ${res.email} (${res.status}). They can accept on this page.`);
      setInviteEmail("");
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Invite failed.");
    } finally {
      setInviting(false);
    }
  }

  async function onAcceptInvite(e: FormEvent) {
    e.preventDefault();
    const orgId = acceptOrgId.trim();
    if (!orgId) return;
    setAccepting(true);
    setError(null);
    setMessage(null);
    try {
      const res = await orgApi.acceptInvite(orgId, ensureAccessToken);
      setMessage(`Joined org as ${res.org_role} (${res.status}).`);
      setAcceptOrgId("");
      await refreshProfile();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Accept invite failed.");
    } finally {
      setAccepting(false);
    }
  }

  return (
    <div className="flex-1 bg-background text-foreground">
      <main className="mx-auto max-w-xl px-4 py-10 sm:px-6">
        <p className="text-xs font-bold uppercase tracking-wider text-primary">Vendor</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight">Become a vendor</h1>
        <p className="mt-2 text-sm text-muted">
          Register as a vendor from an individual account, or after you upgrade to an organization.
          A later organization upgrade keeps this vendor profile.
        </p>

        {isOperator && (
          <section className="mt-6 rounded-xl border border-border bg-surface p-5 text-sm">
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted">
              Verification queue
            </h2>
            {queueError && <p className="mt-3 text-error">{queueError}</p>}
            {queue.length === 0 ? (
              <p className="mt-3 text-muted">No verifications waiting for review.</p>
            ) : (
              <ul className="mt-3 space-y-4">
                {queue.map((item) => (
                  <li key={item.verification_id} className="rounded-lg border border-border p-3">
                    <p className="font-medium">{item.legal_name}</p>
                    <p className="text-muted">{item.contact_email}</p>
                    <p className="mt-1 font-mono text-xs text-muted">{item.submitted_at}</p>
                    {item.business_doc_url && (
                      <a
                        href={item.business_doc_url}
                        className="mt-1 inline-block text-primary hover:underline"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Business document
                      </a>
                    )}
                    <input
                      value={rejectNotes[item.verification_id] ?? ""}
                      onChange={(e) =>
                        setRejectNotes((prev) => ({
                          ...prev,
                          [item.verification_id]: e.target.value,
                        }))
                      }
                      placeholder="Notes (optional, sent on reject)"
                      className="mt-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                    />
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        disabled={decidingId === item.verification_id}
                        onClick={() => void onDecide(item.verification_id, "approved")}
                        className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={decidingId === item.verification_id}
                        onClick={() => void onDecide(item.verification_id, "rejected")}
                        className="rounded-lg border border-border px-3 py-1.5 text-xs font-bold hover:bg-background disabled:opacity-60"
                      >
                        Reject
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        <div className="mt-6 rounded-xl border border-border bg-surface p-5 text-sm">
          <p>
            Org type: <strong>{org?.org_type ?? "—"}</strong>
          </p>
          <p className="mt-1">
            Participation: <strong>{org?.participation ?? "consumer"}</strong>
          </p>
          {eligibility && (
            <p className="mt-3">
              {eligibility.eligible ? (
                <span className="text-primary">Eligible to register.</span>
              ) : (
                <span className="text-error">{eligibility.reasons.join(" ")}</span>
              )}
            </p>
          )}
          {org?.org_type === "individual" && (
            <Link
              href="/app/org"
              className="mt-3 inline-block font-semibold text-primary hover:underline"
            >
              Upgrade to an organization
            </Link>
          )}
        </div>

        {(verification || vendorId) && (
          <section className="mt-6 rounded-xl border border-border bg-surface p-5 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-bold uppercase tracking-wide text-muted">
                Verification status
              </h2>
              {vendorId && (
                <button
                  type="button"
                  disabled={loadingStatus}
                  onClick={() => {
                    if (vendorId) void loadVerification(vendorId);
                  }}
                  className="text-xs font-semibold text-primary hover:underline disabled:opacity-60"
                >
                  {loadingStatus ? "Refreshing…" : "Refresh"}
                </button>
              )}
            </div>
            {loadingStatus && !verification ? (
              <p className="mt-3 text-muted">Loading status…</p>
            ) : verification ? (
              <dl className="mt-3 space-y-2">
                <div>
                  <dt className="text-muted">Vendor status</dt>
                  <dd className="font-medium">{verification.status}</dd>
                </div>
                <div>
                  <dt className="text-muted">Verification</dt>
                  <dd className="font-medium">
                    {verification.verification_status ?? "—"}
                    {verification.verification_id
                      ? ` · ${verification.verification_id.slice(0, 8)}…`
                      : ""}
                  </dd>
                </div>
                {verification.submitted_at && (
                  <div>
                    <dt className="text-muted">Submitted</dt>
                    <dd className="font-mono text-xs">{verification.submitted_at}</dd>
                  </div>
                )}
                {verification.notes && (
                  <div>
                    <dt className="text-muted">Notes</dt>
                    <dd>{verification.notes}</dd>
                  </div>
                )}
              </dl>
            ) : (
              <p className="mt-3 text-muted">No verification loaded yet.</p>
            )}
          </section>
        )}

        <form
          onSubmit={onInvite}
          className="mt-8 space-y-3 rounded-xl border border-border bg-surface p-5"
        >
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Invite org member</h2>
          <p className="text-xs text-muted">
            Invitee must already have an account. Then add them to a tenant on{" "}
            <Link href="/app/members" className="font-semibold text-primary hover:underline">
              Members
            </Link>
            .
          </p>
          <input
            required
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="teammate@example.com"
            disabled={inviting}
            className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={inviting || !org?.org_id}
            className="rounded-lg border border-border px-4 py-2.5 text-sm font-semibold hover:bg-[var(--hero-tint)] disabled:opacity-60"
          >
            {inviting ? "Sending…" : "Send invite"}
          </button>
        </form>

        <form
          onSubmit={onAcceptInvite}
          className="mt-6 space-y-3 rounded-xl border border-border bg-surface p-5"
        >
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Accept org invite</h2>
          <p className="text-xs text-muted">
            Paste the organization ID from the invite (shown to the inviter after send, or from
            their org profile).
          </p>
          <input
            required
            value={acceptOrgId}
            onChange={(e) => setAcceptOrgId(e.target.value)}
            placeholder="org uuid"
            disabled={accepting}
            className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 font-mono text-sm outline-none focus:border-primary disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={accepting}
            className="rounded-lg border border-border px-4 py-2.5 text-sm font-semibold hover:bg-[var(--hero-tint)] disabled:opacity-60"
          >
            {accepting ? "Accepting…" : "Accept invite"}
          </button>
        </form>

        {eligibility?.eligible && (
          <form
            onSubmit={onRegister}
            className="mt-6 space-y-3 rounded-xl border border-border bg-surface p-5"
          >
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted">
              Vendor registration
            </h2>
            <input
              required
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
              placeholder="Legal name"
              disabled={submitting}
              className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary disabled:opacity-60"
            />
            <input
              required
              value={taxId}
              onChange={(e) => setTaxId(e.target.value)}
              placeholder="Tax ID"
              disabled={submitting}
              className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary disabled:opacity-60"
            />
            <input
              required
              value={bank}
              onChange={(e) => setBank(e.target.value)}
              placeholder="Payout bank account"
              disabled={submitting}
              className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary disabled:opacity-60"
            />
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Contact email"
              disabled={submitting}
              className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary disabled:opacity-60"
            />
            <input
              required
              value={docUrl}
              onChange={(e) => setDocUrl(e.target.value)}
              placeholder="Business doc URL"
              disabled={submitting}
              className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
            >
              {submitting ? "Submitting…" : "Register as vendor"}
            </button>
          </form>
        )}

        {error && (
          <p className="mt-4 rounded-lg border border-error/30 bg-error/5 px-3 py-2 text-sm text-error">
            {error}
          </p>
        )}
        {message && (
          <p className="mt-4 rounded-lg border border-border bg-surface px-3 py-2 text-sm">{message}</p>
        )}

        <Link href="/app" className="mt-8 inline-block text-sm font-semibold text-primary hover:underline">
          ← Dashboard
        </Link>
      </main>
    </div>
  );
}

export default function VendorPage() {
  return (
    <RequireAuth>
      <VendorBody />
    </RequireAuth>
  );
}
