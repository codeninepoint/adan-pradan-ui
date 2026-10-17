"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { ApiError, platformAdminApi } from "@/lib/api";

type Role = {
  role_id: string | null;
  name: string;
  scope_type: string;
  is_system_role: boolean;
  tenant_id: string | null;
  status: string;
  permission_codes: string[];
};

type Binding = {
  binding_id: string;
  user_email: string | null;
  role_name: string;
  scope_type: string;
  tenant_name: string | null;
  since: string;
  status: string;
};

const btn =
  "cursor-pointer rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-50";

export default function RolesPage() {
  const { ensureAccessToken, tenantId } = useAuth();
  const [tab, setTab] = useState<"matrix" | "assignments" | "custom">("matrix");
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<{ code: string; scope_type: string }[]>([]);
  const [bindings, setBindings] = useState<Binding[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [basedOn, setBasedOn] = useState("viewer");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [roleData, permData, bindingData] = await Promise.all([
      platformAdminApi.roles(ensureAccessToken),
      platformAdminApi.permissions(ensureAccessToken),
      platformAdminApi.roleBindings(ensureAccessToken),
    ]);
    setRoles(roleData.items);
    setPermissions(permData.items);
    setBindings(bindingData.items);
  }, [ensureAccessToken]);

  useEffect(() => {
    void load().catch((err: unknown) => {
      setError(err instanceof ApiError ? err.detail : "Could not load roles.");
    });
  }, [load]);

  const matrixRoles = useMemo(
    () =>
      roles.filter(
        (r) =>
          r.is_system_role &&
          ["platform-admin", "platform-support", "tenant-admin", "resource-admin", "viewer"].includes(
            r.name,
          ),
      ),
    [roles],
  );
  const customRoles = useMemo(() => roles.filter((r) => !r.is_system_role), [roles]);

  async function onCreateCustom(e: FormEvent) {
    e.preventDefault();
    if (!tenantId) {
      setError("Active tenant required to create a custom role.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await platformAdminApi.createRole(
        { name: name.trim(), based_on: basedOn, tenant_id: tenantId },
        ensureAccessToken,
      );
      setMessage("Custom role created.");
      setName("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Create failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-extrabold tracking-tight">Roles & Permissions</h1>
      <p className="mt-1 text-sm text-muted">
        Seeded system roles and custom tenant roles. Matrix columns match AuthZ catalog names.
      </p>

      <div className="mt-6 flex gap-2">
        {(
          [
            ["matrix", "Permission Matrix"],
            ["assignments", "Role Assignments"],
            ["custom", "Custom Roles"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
              tab === id ? "bg-primary text-primary-foreground" : "bg-surface text-muted"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {message && <p className="mt-4 text-sm text-primary">{message}</p>}
      {error && <p className="mt-4 text-sm text-error">{error}</p>}

      {tab === "matrix" && (
        <div className="mt-4 overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border bg-surface text-muted">
                <th className="px-3 py-2">Permission</th>
                {matrixRoles.map((role) => (
                  <th key={role.name} className="px-2 py-2 text-center">
                    {role.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {permissions.map((perm) => (
                <tr key={perm.code} className="border-b border-border/60">
                  <td className="px-3 py-2 font-mono">{perm.code}</td>
                  {matrixRoles.map((role) => (
                    <td key={role.name} className="px-2 py-2 text-center">
                      {role.permission_codes.includes(perm.code) ? "✓" : "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "assignments" && (
        <div className="mt-4 overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-surface text-xs uppercase text-muted">
                <th className="px-3 py-2">User</th>
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2">Scope</th>
                <th className="px-3 py-2">Since</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {bindings.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-muted">
                    No active bindings.
                  </td>
                </tr>
              )}
              {bindings.map((b) => (
                <tr key={b.binding_id} className="border-b border-border/60">
                  <td className="px-3 py-2">{b.user_email ?? "—"}</td>
                  <td className="px-3 py-2">{b.role_name}</td>
                  <td className="px-3 py-2 text-muted">
                    {b.scope_type}
                    {b.tenant_name ? ` · ${b.tenant_name}` : ""}
                  </td>
                  <td className="px-3 py-2 text-muted">{b.since}</td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      className={btn}
                      onClick={() => {
                        void platformAdminApi
                          .revokeBinding(b.binding_id, ensureAccessToken)
                          .then(() => load())
                          .catch((err: unknown) =>
                            setError(err instanceof ApiError ? err.detail : "Revoke failed"),
                          );
                      }}
                    >
                      Revoke
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "custom" && (
        <div className="mt-4 space-y-4">
          <form onSubmit={onCreateCustom} className="space-y-3 rounded-xl border border-border bg-surface p-5">
            <h2 className="font-semibold">New custom role</h2>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Role name"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
            <select
              value={basedOn}
              onChange={(e) => setBasedOn(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="tenant-admin">Based on tenant-admin</option>
              <option value="resource-admin">Based on resource-admin</option>
              <option value="viewer">Based on viewer</option>
            </select>
            <p className="text-xs text-muted">Created on your active tenant ({tenantId?.slice(0, 8)}…).</p>
            <button type="submit" disabled={busy} className={btn}>
              {busy ? "Creating…" : "Create custom role"}
            </button>
          </form>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-surface text-xs uppercase text-muted">
                  <th className="px-3 py-2">Role</th>
                  <th className="px-3 py-2">Tenant</th>
                  <th className="px-3 py-2">Permissions</th>
                </tr>
              </thead>
              <tbody>
                {customRoles.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-3 py-6 text-muted">
                      No custom roles yet.
                    </td>
                  </tr>
                )}
                {customRoles.map((role) => (
                  <tr key={role.role_id ?? role.name} className="border-b border-border/60">
                    <td className="px-3 py-2 font-medium">{role.name}</td>
                    <td className="px-3 py-2 text-muted">{role.tenant_id?.slice(0, 8) ?? "—"}</td>
                    <td className="px-3 py-2 font-mono text-xs text-muted">
                      {role.permission_codes.join(", ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  );
}
