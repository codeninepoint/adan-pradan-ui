"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { ApiError, platformAdminApi } from "@/lib/api";

type User = {
  user_id: string;
  email: string;
  display_name: string;
  principal_type: string;
  status: string;
  tenant_name: string | null;
  org_name: string | null;
  role_label: string | null;
  is_platform_operator: boolean;
  last_active_at: string | null;
};

const btn =
  "cursor-pointer rounded-lg border border-border bg-background px-2 py-1 text-[11px] font-semibold hover:border-primary disabled:opacity-50";

export default function AllUsersPage() {
  const { ensureAccessToken } = useAuth();
  const [items, setItems] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [principalType, setPrincipalType] = useState("all");
  const [status, setStatus] = useState("all");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const data = await platformAdminApi.users(ensureAccessToken, {
      q: q.trim() || undefined,
      principal_type: principalType === "all" ? undefined : principalType,
      status: status === "all" ? undefined : status,
    });
    setItems(data.items);
    setTotal(data.total);
  }, [ensureAccessToken, q, principalType, status]);

  useEffect(() => {
    void load().catch((err: unknown) => {
      setError(err instanceof ApiError ? err.detail : "Could not load users.");
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
      <h1 className="text-2xl font-extrabold tracking-tight">All Users</h1>
      <p className="mt-1 text-sm text-muted">
        Cross-tenant directory of user accounts and service accounts ({total} total).
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name or email…"
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
        <select
          value={principalType}
          onChange={(e) => setPrincipalType(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="all">All types</option>
          <option value="user">User Account</option>
          <option value="service_account">Service Account</option>
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="pending_verification">Pending</option>
          <option value="locked">Suspended</option>
          <option value="blocked">Blocked</option>
        </select>
      </div>

      {message && <p className="mt-4 text-sm text-primary">{message}</p>}
      {error && <p className="mt-4 text-sm text-error">{error}</p>}

      <div className="mt-4 overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-surface text-xs uppercase text-muted">
              <th className="px-3 py-2">User</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Tenant / Org</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((user) => (
              <tr key={`${user.principal_type}-${user.user_id}`} className="border-b border-border/60">
                <td className="px-3 py-2">
                  <p className="font-medium">{user.display_name}</p>
                  <p className="text-xs text-muted">{user.email}</p>
                </td>
                <td className="px-3 py-2">{user.principal_type}</td>
                <td className="px-3 py-2">
                  {user.is_platform_operator ? "platform_operator" : user.role_label ?? "—"}
                </td>
                <td className="px-3 py-2 text-muted">
                  {user.tenant_name ?? "—"}
                  {user.org_name ? ` / ${user.org_name}` : ""}
                </td>
                <td className="px-3 py-2">{user.status}</td>
                <td className="px-3 py-2">
                  {user.principal_type === "user" && (
                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        className={btn}
                        disabled={busy !== null}
                        onClick={() =>
                          void act(
                            `s-${user.user_id}`,
                            () => platformAdminApi.suspendUser(user.user_id, ensureAccessToken),
                            "Suspended.",
                          )
                        }
                      >
                        Suspend
                      </button>
                      <button
                        type="button"
                        className={btn}
                        disabled={busy !== null}
                        onClick={() =>
                          void act(
                            `r-${user.user_id}`,
                            () => platformAdminApi.reinstateUser(user.user_id, ensureAccessToken),
                            "Reinstated.",
                          )
                        }
                      >
                        Reinstate
                      </button>
                      <button
                        type="button"
                        className={btn}
                        disabled={busy !== null}
                        onClick={() =>
                          void act(
                            `b-${user.user_id}`,
                            () => platformAdminApi.blockUser(user.user_id, ensureAccessToken),
                            "Blocked.",
                          )
                        }
                      >
                        Block
                      </button>
                      <button
                        type="button"
                        className={btn}
                        disabled={busy !== null}
                        onClick={() =>
                          void act(
                            `m-${user.user_id}`,
                            () => platformAdminApi.resetMfa(user.user_id, ensureAccessToken),
                            "MFA reset.",
                          )
                        }
                      >
                        Reset MFA
                      </button>
                      {!user.is_platform_operator && (
                        <button
                          type="button"
                          className={btn}
                          disabled={busy !== null}
                          onClick={() =>
                            void act(
                              `p-${user.user_id}`,
                              () => platformAdminApi.promoteOperator(user.user_id, ensureAccessToken),
                              "Promoted to operator.",
                            )
                          }
                        >
                          Promote
                        </button>
                      )}
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
