"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { ApiError, platformAdminApi } from "@/lib/api";

type Item = {
  plugin_id: string | null;
  category: string;
  name: string | null;
  slug: string | null;
  status: string | null;
  short_description: string | null;
  version: string | null;
  requirements: unknown[];
  updated_at: string | null;
};

const btn =
  "cursor-pointer rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-50";

export default function StandardPluginsPage() {
  const { ensureAccessToken } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [creatingFor, setCreatingFor] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [version, setVersion] = useState("1.0.0");
  const [artifactUrl, setArtifactUrl] = useState("https://platform.local/plugins/artifact.zip");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const data = await platformAdminApi.standardPlugins(ensureAccessToken);
    setItems(data.items);
  }, [ensureAccessToken]);

  useEffect(() => {
    void load().catch((err: unknown) => {
      setError(err instanceof ApiError ? err.detail : "Could not load standard plugins.");
    });
  }, [load]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!creatingFor) return;
    setBusy(true);
    setError(null);
    try {
      await platformAdminApi.createStandardPlugin(
        {
          name: name.trim(),
          slug: slug.trim(),
          category: creatingFor,
          short_description: description.trim(),
          version: version.trim(),
          artifact_url: artifactUrl.trim(),
          publish: true,
        },
        ensureAccessToken,
      );
      setMessage(`Created standard plugin for ${creatingFor}.`);
      setCreatingFor(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Create failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-extrabold tracking-tight">Standard Plugins</h1>
      <p className="mt-1 text-sm text-muted">
        Platform-owned plugins available to verified vendors without review.
      </p>
      <div className="mt-4 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
        One standard plugin per fulfilment category. Create where a slot is empty; publish, unpublish, or
        deprecate as needed.
      </div>

      {message && <p className="mt-4 text-sm text-primary">{message}</p>}
      {error && <p className="mt-4 text-sm text-error">{error}</p>}

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <div key={item.category} className="rounded-xl border border-border bg-surface p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted">{item.category}</p>
                <p className="mt-1 font-semibold">{item.name ?? "Not created"}</p>
              </div>
              {item.status && (
                <span className="rounded-full bg-background px-2 py-0.5 text-[10px] font-bold uppercase">
                  {item.status}
                </span>
              )}
            </div>
            <p className="mt-2 text-xs text-muted">
              {item.short_description || "No platform standard plugin for this category yet."}
            </p>
            {item.version && <p className="mt-2 text-xs text-muted">v{item.version}</p>}
            <div className="mt-3 flex flex-wrap gap-1">
              {!item.plugin_id ? (
                <button
                  type="button"
                  className={btn}
                  onClick={() => {
                    setCreatingFor(item.category);
                    setName(`Standard ${item.category}`);
                    setSlug(`platform-standard-${item.category.toLowerCase().replace(/_/g, "-")}`);
                    setDescription("");
                  }}
                >
                  Create
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className={btn}
                    disabled={busy}
                    onClick={() => {
                      setBusy(true);
                      void platformAdminApi
                        .publishStandardPlugin(item.plugin_id!, ensureAccessToken)
                        .then(() => load())
                        .catch((err: unknown) =>
                          setError(err instanceof ApiError ? err.detail : "Publish failed"),
                        )
                        .finally(() => setBusy(false));
                    }}
                  >
                    Publish
                  </button>
                  <button
                    type="button"
                    className={btn}
                    disabled={busy}
                    onClick={() => {
                      setBusy(true);
                      void platformAdminApi
                        .unpublishStandardPlugin(item.plugin_id!, ensureAccessToken)
                        .then(() => load())
                        .catch((err: unknown) =>
                          setError(err instanceof ApiError ? err.detail : "Unpublish failed"),
                        )
                        .finally(() => setBusy(false));
                    }}
                  >
                    Unpublish
                  </button>
                  <button
                    type="button"
                    className={btn}
                    disabled={busy}
                    onClick={() => {
                      setBusy(true);
                      void platformAdminApi
                        .deprecateStandardPlugin(item.plugin_id!, ensureAccessToken)
                        .then(() => load())
                        .catch((err: unknown) =>
                          setError(err instanceof ApiError ? err.detail : "Deprecate failed"),
                        )
                        .finally(() => setBusy(false));
                    }}
                  >
                    Deprecate
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {creatingFor && (
        <form
          onSubmit={onCreate}
          className="mt-6 space-y-3 rounded-xl border border-border bg-surface p-5"
        >
          <h2 className="font-semibold">Create · {creatingFor}</h2>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <input
            required
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="slug"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <input
            required
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            placeholder="version"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <input
            required
            value={artifactUrl}
            onChange={(e) => setArtifactUrl(e.target.value)}
            placeholder="artifact_url"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            rows={3}
          />
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className={btn}>
              {busy ? "Creating…" : "Create & publish"}
            </button>
            <button
              type="button"
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold"
              onClick={() => setCreatingFor(null)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </main>
  );
}
