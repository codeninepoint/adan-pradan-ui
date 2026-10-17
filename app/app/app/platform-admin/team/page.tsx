"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { ApiError, platformAdminApi } from "@/lib/api";

type TeamMember = {
  id: string;
  email: string;
  platform_role: string;
  status: string;
  mfa_enabled: boolean;
  invited_at: string;
  activated_at: string | null;
};

const TEAM_ROLES = [
  "platform_admin",
  "finance_manager",
  "content_moderator",
  "kyc_reviewer",
  "support_agent",
] as const;

const btn =
  "cursor-pointer rounded-lg border border-border bg-background px-2 py-1 text-[11px] font-semibold hover:border-primary disabled:opacity-50";

const btnPrimary =
  "cursor-pointer rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-50";

export default function TeamPage() {
  const { ensureAccessToken } = useAuth();
  const [items, setItems] = useState<TeamMember[]>([]);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<string>(TEAM_ROLES[0]);
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferRecipient, setTransferRecipient] = useState("");
  const [transferPassword, setTransferPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const data = await platformAdminApi.team(ensureAccessToken);
    setItems(data.items);
  }, [ensureAccessToken]);

  useEffect(() => {
    void load().catch((err: unknown) => {
      setError(err instanceof ApiError ? err.detail : "Could not load team.");
    });
  }, [load]);

  async function act(key: string, fn: () => Promise<unknown>, ok: string) {
    setBusy(key);
    setError(null);
    setMessage(null);
    try {
      await fn();
      setMessage(ok);
      setShowInvite(false);
      setShowTransfer(false);
      setInviteEmail("");
      setTransferPassword("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Action failed.");
    } finally {
      setBusy(null);
    }
  }

  const transferCandidates = items.filter(
    (m) => m.platform_role !== "super_admin" && m.status === "active",
  );

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Team Management</h1>
          <p className="mt-1 text-sm text-muted">Platform operator team roles and access.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" className={btnPrimary} onClick={() => setShowInvite(true)}>
            Invite member
          </button>
          <button type="button" className={btn} onClick={() => setShowTransfer(true)}>
            Transfer super-admin
          </button>
        </div>
      </div>

      {message && <p className="mt-4 text-sm text-primary">{message}</p>}
      {error && <p className="mt-4 text-sm text-error">{error}</p>}

      {showInvite && (
        <section className="mt-6 rounded-xl border border-border bg-surface p-4">
          <h2 className="text-sm font-semibold">Invite team member</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="Email"
              type="email"
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              {TEAM_ROLES.map((role) => (
                <option key={role} value={role}>
                  {role.replace(/_/g, " ")}
                </option>
              ))}
            </select>
            <button
              type="button"
              className={btnPrimary}
              disabled={busy !== null || !inviteEmail.trim()}
              onClick={() =>
                void act(
                  "invite",
                  () =>
                    platformAdminApi.inviteTeam(
                      { email: inviteEmail.trim(), platform_role: inviteRole },
                      ensureAccessToken,
                    ),
                  "Invitation sent.",
                )
              }
            >
              Send invite
            </button>
            <button type="button" className={btn} onClick={() => setShowInvite(false)}>
              Cancel
            </button>
          </div>
        </section>
      )}

      {showTransfer && (
        <section className="mt-6 rounded-xl border border-border bg-surface p-4">
          <h2 className="text-sm font-semibold">Transfer super-admin</h2>
          <p className="mt-1 text-xs text-muted">Requires your password to confirm.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <select
              value={transferRecipient}
              onChange={(e) => setTransferRecipient(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">Select recipient…</option>
              {transferCandidates.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.email} ({m.platform_role})
                </option>
              ))}
            </select>
            <input
              value={transferPassword}
              onChange={(e) => setTransferPassword(e.target.value)}
              placeholder="Your password"
              type="password"
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
            <button
              type="button"
              className={btnPrimary}
              disabled={busy !== null || !transferRecipient || !transferPassword}
              onClick={() =>
                void act(
                  "transfer",
                  () =>
                    platformAdminApi.transferSuperAdmin(
                      {
                        recipient_member_id: transferRecipient,
                        password: transferPassword,
                      },
                      ensureAccessToken,
                    ),
                  "Super-admin transferred.",
                )
              }
            >
              Transfer
            </button>
            <button type="button" className={btn} onClick={() => setShowTransfer(false)}>
              Cancel
            </button>
          </div>
        </section>
      )}

      <div className="mt-6 overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-surface text-xs uppercase text-muted">
              <th className="px-3 py-2">Member</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">MFA</th>
              <th className="px-3 py-2">Invited</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-muted">
                  No team members.
                </td>
              </tr>
            )}
            {items.map((member) => (
              <tr key={member.id} className="border-b border-border/60">
                <td className="px-3 py-2">
                  <p className="font-medium">{member.email}</p>
                </td>
                <td className="px-3 py-2">
                  {member.platform_role === "super_admin" ? (
                    member.platform_role
                  ) : (
                    <select
                      value={member.platform_role}
                      disabled={busy !== null || member.status !== "active"}
                      onChange={(e) =>
                        void act(
                          `role-${member.id}`,
                          () =>
                            platformAdminApi.updateTeamRole(
                              member.id,
                              e.target.value,
                              ensureAccessToken,
                            ),
                          "Role updated.",
                        )
                      }
                      className="rounded border border-border bg-background px-2 py-1 text-xs"
                    >
                      {TEAM_ROLES.map((role) => (
                        <option key={role} value={role}>
                          {role.replace(/_/g, " ")}
                        </option>
                      ))}
                    </select>
                  )}
                </td>
                <td className="px-3 py-2">{member.status}</td>
                <td className="px-3 py-2">{member.mfa_enabled ? "Yes" : "No"}</td>
                <td className="px-3 py-2 text-muted">{member.invited_at}</td>
                <td className="px-3 py-2">
                  {member.platform_role !== "super_admin" && (
                    <div className="flex flex-wrap gap-1">
                      {member.status === "active" && (
                        <button
                          type="button"
                          className={btn}
                          disabled={busy !== null}
                          onClick={() =>
                            void act(
                              `s-${member.id}`,
                              () => platformAdminApi.suspendTeamMember(member.id, ensureAccessToken),
                              "Member suspended.",
                            )
                          }
                        >
                          Suspend
                        </button>
                      )}
                      {member.status === "suspended" && (
                        <button
                          type="button"
                          className={btn}
                          disabled={busy !== null}
                          onClick={() =>
                            void act(
                              `r-${member.id}`,
                              () => platformAdminApi.reactivateTeamMember(member.id, ensureAccessToken),
                              "Member reactivated.",
                            )
                          }
                        >
                          Reactivate
                        </button>
                      )}
                      <button
                        type="button"
                        className={btn}
                        disabled={busy !== null}
                        onClick={() =>
                          void act(
                            `m-${member.id}`,
                            () => platformAdminApi.resetTeamMfa(member.id, ensureAccessToken),
                            "MFA reset.",
                          )
                        }
                      >
                        Reset MFA
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
