"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { ApiError, platformAdminApi } from "@/lib/api";

type Policy = {
  id: string;
  name: string;
  scope: string;
  enforcement: string;
  applies_to: string;
  status: string;
};

const btn =
  "cursor-pointer rounded-lg border border-border bg-background px-2 py-1 text-[11px] font-semibold hover:border-primary disabled:opacity-50";

const btnPrimary =
  "cursor-pointer rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-50";

export default function PoliciesPage() {
  const { ensureAccessToken } = useAuth();
  const [items, setItems] = useState<Policy[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEnforcement, setEditEnforcement] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const data = await platformAdminApi.policies(ensureAccessToken);
    setItems(data.items);
  }, [ensureAccessToken]);

  useEffect(() => {
    void load().catch((err: unknown) => {
      setError(err instanceof ApiError ? err.detail : "Could not load policies.");
    });
  }, [load]);

  async function act(key: string, fn: () => Promise<unknown>, ok: string) {
    setBusy(key);
    setError(null);
    setMessage(null);
    try {
      await fn();
      setMessage(ok);
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Action failed.");
    } finally {
      setBusy(null);
    }
  }

  function startEdit(policy: Policy) {
    setEditingId(policy.id);
    setEditName(policy.name);
    setEditEnforcement(policy.enforcement);
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-extrabold tracking-tight">Policies</h1>
      <p className="mt-1 text-sm text-muted">Platform governance policies and enforcement rules.</p>

      {message && <p className="mt-4 text-sm text-primary">{message}</p>}
      {error && <p className="mt-4 text-sm text-error">{error}</p>}

      <div className="mt-6 overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-surface text-xs uppercase text-muted">
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Scope</th>
              <th className="px-3 py-2">Enforcement</th>
              <th className="px-3 py-2">Applies to</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-muted">
                  No policies configured.
                </td>
              </tr>
            )}
            {items.map((policy) => (
              <tr key={policy.id} className="border-b border-border/60">
                <td className="px-3 py-2">
                  {editingId === policy.id ? (
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full rounded border border-border bg-background px-2 py-1 text-sm"
                    />
                  ) : (
                    <span className="font-medium">{policy.name}</span>
                  )}
                </td>
                <td className="px-3 py-2">{policy.scope}</td>
                <td className="px-3 py-2">
                  {editingId === policy.id ? (
                    <select
                      value={editEnforcement}
                      onChange={(e) => setEditEnforcement(e.target.value)}
                      className="rounded border border-border bg-background px-2 py-1 text-sm"
                    >
                      <option value="mandatory">mandatory</option>
                      <option value="advisory">advisory</option>
                      <option value="disabled">disabled</option>
                    </select>
                  ) : (
                    policy.enforcement
                  )}
                </td>
                <td className="px-3 py-2 text-muted">{policy.applies_to || "—"}</td>
                <td className="px-3 py-2">{policy.status}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {editingId === policy.id ? (
                      <>
                        <button
                          type="button"
                          className={btnPrimary}
                          disabled={busy !== null || !editName.trim()}
                          onClick={() =>
                            void act(
                              `save-${policy.id}`,
                              () =>
                                platformAdminApi.updatePolicy(
                                  policy.id,
                                  { name: editName.trim(), enforcement: editEnforcement },
                                  ensureAccessToken,
                                ),
                              "Policy updated.",
                            )
                          }
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          className={btn}
                          disabled={busy !== null}
                          onClick={() => setEditingId(null)}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className={btn}
                          disabled={busy !== null}
                          onClick={() => startEdit(policy)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className={btn}
                          disabled={busy !== null}
                          onClick={() =>
                            void act(
                              `toggle-${policy.id}`,
                              () => platformAdminApi.togglePolicy(policy.id, ensureAccessToken),
                              "Policy toggled.",
                            )
                          }
                        >
                          Toggle
                        </button>
                      </>
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
