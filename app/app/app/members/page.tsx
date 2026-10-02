"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { RequireAuth } from "@/components/auth-guards";
import { useAuth } from "@/components/auth-provider";
import {
  ApiError,
  membersApi,
  tenantMembersApi,
  type MemberItem,
  type RoleItem,
} from "@/lib/api";

function MembersBody() {
  const { tenantId, ensureAccessToken, profile } = useAuth();
  const org = profile?.organizations[0];
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [userId, setUserId] = useState("");
  const [roleId, setRoleId] = useState("");
  const [justification, setJustification] = useState("");
  const [inviteUserId, setInviteUserId] = useState("");
  const [inviteRole, setInviteRole] = useState("viewer");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [inviting, setInviting] = useState(false);

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const [m, r] = await Promise.all([
        membersApi.listMembers(tenantId, ensureAccessToken),
        membersApi.listRoles(tenantId, ensureAccessToken),
      ]);
      setMembers(m.items);
      setRoles(r.items);
      setUserId((prev) => prev || m.items[0]?.user_id || "");
      setRoleId((prev) => {
        if (prev) return prev;
        const resourceAdmin = r.items.find((x) => x.name === "resource-admin");
        return resourceAdmin?.role_id ?? r.items[0]?.role_id ?? "";
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Failed to load members.");
    } finally {
      setLoading(false);
    }
  }, [tenantId, ensureAccessToken]);

  useEffect(() => {
    void load();
    // intentionally once on tenant ready
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  async function onGrant(e: FormEvent) {
    e.preventDefault();
    if (!tenantId || !roleId || !userId) return;
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const result = await membersApi.grant(
        tenantId,
        roleId,
        { user_id: userId, justification: justification.trim() || undefined },
        ensureAccessToken,
      );
      setMessage(`Granted ${result.role}.`);
      setJustification("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Grant failed.");
    } finally {
      setSubmitting(false);
    }
  }

  async function onRevoke(member: MemberItem, bindingId: string, roleIdForBinding: string) {
    if (!tenantId) return;
    setError(null);
    setMessage(null);
    try {
      await membersApi.revoke(
        tenantId,
        roleIdForBinding,
        bindingId,
        "revoked from members UI",
        ensureAccessToken,
      );
      setMessage(`Revoked role for ${member.email}.`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Revoke failed.");
    }
  }

  async function onInviteTenant(e: FormEvent) {
    e.preventDefault();
    if (!tenantId || !inviteUserId.trim()) return;
    setInviting(true);
    setError(null);
    setMessage(null);
    try {
      const result = await tenantMembersApi.invite(
        tenantId,
        { user_id: inviteUserId.trim(), role: inviteRole },
        ensureAccessToken,
      );
      setMessage(`Added user to tenant as ${result.role} (${result.status}).`);
      setInviteUserId("");
      await load();
    } catch (err) {
      const detail = err instanceof ApiError ? err.detail : "Tenant invite failed.";
      const hint =
        detail.toLowerCase().includes("org member") || detail.toLowerCase().includes("not found")
          ? " Invite them to the organization first on Vendor → Invite org member."
          : "";
      setError(`${detail}${hint}`);
    } finally {
      setInviting(false);
    }
  }

  return (
    <div className="flex-1 bg-background text-foreground">
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <Link href="/app" className="text-sm font-medium text-primary hover:underline">
          ← Back to dashboard
        </Link>
        <p className="mt-6 text-xs font-bold uppercase tracking-wider text-primary">AuthZ · J10–J11</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight">Members & roles</h1>
        <p className="mt-2 text-sm text-muted">
          Signed in as {profile?.email ?? "—"}. Grant and revoke tenant roles (live AuthZ — next request
          picks up changes). Org: {org?.name ?? "—"}.
        </p>

        <section className="mt-8 rounded-xl border border-border bg-surface p-5">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted">
            Invite to this tenant (J14)
          </h2>
          <p className="mt-2 text-xs text-muted">
            User must already be an <strong>org member</strong>. Invite to the org first on{" "}
            <Link href="/app/vendor" className="font-semibold text-primary hover:underline">
              Vendor
            </Link>
            , then paste their <code className="text-[11px]">user_id</code> here.
          </p>
          <form onSubmit={onInviteTenant} className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-bold uppercase tracking-wide text-muted sm:col-span-2">
              User ID
              <input
                required
                value={inviteUserId}
                onChange={(e) => setInviteUserId(e.target.value)}
                placeholder="uuid of existing org member"
                disabled={inviting}
                className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2.5 font-mono text-sm font-normal normal-case tracking-normal text-foreground outline-none focus:border-primary disabled:opacity-60"
              />
            </label>
            <label className="text-xs font-bold uppercase tracking-wide text-muted">
              Role
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                disabled={inviting}
                className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm font-normal normal-case tracking-normal text-foreground outline-none focus:border-primary disabled:opacity-60"
              >
                {roles.map((r) => (
                  <option key={r.role_id} value={r.name}>
                    {r.name}
                  </option>
                ))}
                {roles.length === 0 && (
                  <>
                    <option value="viewer">viewer</option>
                    <option value="resource-admin">resource-admin</option>
                  </>
                )}
              </select>
            </label>
            <button
              type="submit"
              disabled={inviting || !tenantId}
              className="self-end rounded-lg border border-border px-4 py-2.5 text-sm font-semibold hover:bg-[var(--hero-tint)] disabled:opacity-60"
            >
              {inviting ? "Inviting…" : "Add to tenant"}
            </button>
          </form>
        </section>

        <section className="mt-8 rounded-xl border border-border bg-surface p-5">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Grant role</h2>
          <form onSubmit={onGrant} className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-bold uppercase tracking-wide text-muted">
              Member
              <select
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm font-normal normal-case tracking-normal text-foreground outline-none focus:border-primary"
              >
                {members.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.display_name} ({m.email})
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-bold uppercase tracking-wide text-muted">
              Role
              <select
                value={roleId}
                onChange={(e) => setRoleId(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm font-normal normal-case tracking-normal text-foreground outline-none focus:border-primary"
              >
                {roles.map((r) => (
                  <option key={r.role_id} value={r.role_id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-bold uppercase tracking-wide text-muted sm:col-span-2">
              Justification (optional)
              <input
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm font-normal normal-case tracking-normal text-foreground outline-none focus:border-primary"
                placeholder="Why this role is needed"
              />
            </label>
            <button
              type="submit"
              disabled={submitting || !tenantId}
              className="rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-60 sm:col-span-2"
            >
              {submitting ? "Granting…" : "Grant role"}
            </button>
          </form>
        </section>

        {error && (
          <p className="mt-4 rounded-lg border border-error/30 bg-error/5 px-3 py-2 text-sm text-error">
            {error}
          </p>
        )}
        {message && (
          <p className="mt-4 rounded-lg border border-success/30 bg-success/5 px-3 py-2 text-sm text-success">
            {message}
          </p>
        )}

        <section className="mt-8 rounded-xl border border-border bg-surface p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Members</h2>
            <button
              type="button"
              onClick={() => void load()}
              className="text-xs font-semibold text-primary hover:underline"
            >
              Refresh
            </button>
          </div>
          {loading ? (
            <p className="mt-4 text-sm text-muted">Loading…</p>
          ) : (
            <ul className="mt-4 space-y-4">
              {members.map((m) => (
                <li key={m.user_id} className="rounded-lg border border-border bg-background p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div>
                      <p className="font-semibold">{m.display_name}</p>
                      <p className="text-sm text-muted">{m.email}</p>
                    </div>
                    <p className="font-mono text-[10px] text-muted">{m.user_id.slice(0, 8)}…</p>
                  </div>
                  <ul className="mt-3 space-y-2">
                    {m.bindings.length === 0 ? (
                      <li className="text-sm text-muted">No active roles</li>
                    ) : (
                      m.bindings.map((b) => (
                        <li
                          key={b.binding_id}
                          className="flex flex-wrap items-center justify-between gap-2 text-sm"
                        >
                          <span>
                            <span className="font-medium">{b.role_name}</span>
                            <span className="text-muted"> · {b.status}</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => void onRevoke(m, b.binding_id, b.role_id)}
                            className="text-xs font-semibold text-error hover:underline"
                          >
                            Revoke
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

export default function MembersPage() {
  return (
    <RequireAuth>
      <MembersBody />
    </RequireAuth>
  );
}
