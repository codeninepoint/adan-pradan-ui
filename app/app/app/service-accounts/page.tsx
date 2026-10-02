"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { RequireAuth } from "@/components/auth-guards";
import { useAuth } from "@/components/auth-provider";
import {
  ApiError,
  serviceAccountsApi,
  type CreateServiceAccountResponse,
  type ServiceAccountItem,
} from "@/lib/api";

function ServiceAccountsBody() {
  const { tenantId, ensureAccessToken } = useAuth();
  const [items, setItems] = useState<ServiceAccountItem[]>([]);
  const [name, setName] = useState("sa-deploy-prod");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [createdKey, setCreatedKey] = useState<CreateServiceAccountResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await serviceAccountsApi.list(tenantId, ensureAccessToken);
      setItems(data.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Failed to load service accounts.");
    } finally {
      setLoading(false);
    }
  }, [tenantId, ensureAccessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!tenantId) return;
    setSubmitting(true);
    setError(null);
    setCreatedKey(null);
    try {
      const res = await serviceAccountsApi.create(
        tenantId,
        {
          name: name.trim(),
          description: description.trim() || undefined,
          initial_role: "resource-admin",
        },
        ensureAccessToken,
      );
      setCreatedKey(res);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Create failed.");
    } finally {
      setSubmitting(false);
    }
  }

  async function onRotate(saId: string) {
    if (!tenantId) return;
    setError(null);
    try {
      const res = await serviceAccountsApi.rotate(
        tenantId,
        saId,
        "UI rotation",
        ensureAccessToken,
      );
      setCreatedKey({
        service_account_id: saId,
        principal_id: "",
        name: "",
        api_key: res.new_api_key,
        key_prefix: res.new_key_prefix,
        key_id: res.new_key_id,
        status: "active",
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Rotate failed.");
    }
  }

  return (
    <div className="flex-1 bg-background text-foreground">
      <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <p className="text-xs font-bold uppercase tracking-wider text-primary">Automation</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight">Service accounts</h1>
        <p className="mt-2 text-sm text-muted">
          Create robot principals and rotate API keys. Keys are shown once.
        </p>

        <form onSubmit={onCreate} className="mt-8 space-y-3 rounded-xl border border-border bg-surface p-5">
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="sa-name"
            className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary"
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary"
          />
          <button
            type="submit"
            disabled={submitting || !tenantId}
            className="rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
          >
            {submitting ? "Creating…" : "Create service account"}
          </button>
        </form>

        {createdKey && (
          <div className="mt-4 rounded-lg border border-border bg-surface px-4 py-3 text-sm">
            <p className="font-semibold">Copy this API key now — it won&apos;t be shown again.</p>
            <code className="mt-2 block break-all font-mono text-xs">{createdKey.api_key}</code>
          </div>
        )}

        {error && (
          <p className="mt-4 rounded-lg border border-error/30 bg-error/5 px-3 py-2 text-sm text-error">
            {error}
          </p>
        )}

        <section className="mt-8">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Active accounts</h2>
          {loading ? (
            <p className="mt-3 text-sm text-muted">Loading…</p>
          ) : items.length === 0 ? (
            <p className="mt-3 text-sm text-muted">No service accounts yet.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {items.map((sa) => (
                <li
                  key={sa.service_account_id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-surface px-4 py-3 text-sm"
                >
                  <div>
                    <p className="font-semibold">{sa.name}</p>
                    <p className="font-mono text-xs text-muted">
                      {sa.key_prefix ?? "no active key"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void onRotate(sa.service_account_id)}
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    Rotate key
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <Link href="/app" className="mt-8 inline-block text-sm font-semibold text-primary hover:underline">
          ← Dashboard
        </Link>
      </main>
    </div>
  );
}

export default function ServiceAccountsPage() {
  return (
    <RequireAuth>
      <ServiceAccountsBody />
    </RequireAuth>
  );
}
