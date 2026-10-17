"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { ApiError, platformAdminApi } from "@/lib/api";

type AuditItem = {
  id: string;
  event_action: string;
  actor_email: string | null;
  tenant_id: string | null;
  payload: Record<string, unknown>;
  created_at: string;
};

const ACTION_PREFIXES = [
  { label: "All", value: "" },
  { label: "Tenant", value: "tenant" },
  { label: "Vendor", value: "vendor" },
  { label: "User", value: "user" },
  { label: "Plugin", value: "plugin" },
  { label: "Policy", value: "policy" },
  { label: "Team", value: "team" },
];

export default function AuditLogPage() {
  const { ensureAccessToken } = useAuth();
  const [items, setItems] = useState<AuditItem[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [prefix, setPrefix] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const searchQ = [prefix, q.trim()].filter(Boolean).join(" ") || undefined;
    const data = await platformAdminApi.auditLog(ensureAccessToken, { q: searchQ });
    setItems(data.items);
    setTotal(data.total);
  }, [ensureAccessToken, q, prefix]);

  useEffect(() => {
    void load().catch((err: unknown) => {
      setError(err instanceof ApiError ? err.detail : "Could not load audit log.");
    });
  }, [load]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-extrabold tracking-tight">Audit Log</h1>
      <p className="mt-1 text-sm text-muted">Immutable record of platform actions ({total} entries).</p>

      <div className="mt-6 flex flex-wrap gap-2">
        {ACTION_PREFIXES.map((chip) => (
          <button
            key={chip.label}
            type="button"
            onClick={() => setPrefix(chip.value)}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              prefix === chip.value ? "bg-primary text-primary-foreground" : "bg-surface text-muted"
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search actions…"
          className="w-full max-w-md rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
      </div>

      {error && <p className="mt-4 text-sm text-error">{error}</p>}

      <div className="mt-4 overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-surface text-xs uppercase text-muted">
              <th className="px-3 py-2">Action</th>
              <th className="px-3 py-2">Actor</th>
              <th className="px-3 py-2">Tenant</th>
              <th className="px-3 py-2">When</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-muted">
                  No audit entries match.
                </td>
              </tr>
            )}
            {items.map((item) => (
              <tr key={item.id} className="border-b border-border/60">
                <td className="px-3 py-2 font-medium">{item.event_action}</td>
                <td className="px-3 py-2 text-muted">{item.actor_email ?? "—"}</td>
                <td className="px-3 py-2 text-muted">{item.tenant_id ?? "—"}</td>
                <td className="px-3 py-2 text-muted">{item.created_at}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
