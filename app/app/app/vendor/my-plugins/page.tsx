"use client";

import { FormEvent, ReactNode, useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { useVendorPortal } from "@/components/vendor/portal";
import { ApiError, marketplaceApi, VendorPluginItem } from "@/lib/api";

const PLUGIN_CATEGORIES = [
  "SHIP_PHYSICAL",
  "DELIVER_DIGITAL",
  "LICENSE_SOFTWARE",
  "PROVISION_SOFTWARE",
  "PROVISION_CLOUD",
  "STREAM_LMS_COURSE",
  "DELIVER_MULTIMEDIA",
  "DISPATCH_SERVICE",
  "BOOK_APPOINTMENT",
];

const inputClass =
  "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary";
const buttonClass =
  "cursor-pointer rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50";
const ghostClass =
  "cursor-pointer rounded-lg border border-border px-3 py-1.5 text-xs font-semibold disabled:opacity-50";

const SEMVER_RE = /^\d+\.\d+\.\d+(-[\w.]+)?(\+[\w.]+)?$/;

type SubmitPreset = {
  plugin_id?: string;
  name?: string;
  category?: string;
};

function categoryLabel(category: string): string {
  return category
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

function reviewStatusLabel(status: string | null): { label: string; className: string } {
  switch (status) {
    case "approved":
      return { label: "Approved", className: "bg-success/15 text-success" };
    case "rejected":
      return { label: "Rejected", className: "bg-error/15 text-error" };
    case "pending_review":
    case "changes_requested":
      return { label: "Under Review", className: "bg-primary/15 text-primary" };
    default:
      return { label: status ?? "Draft", className: "bg-background text-muted" };
  }
}

function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-label={title}
        className="my-8 w-full max-w-lg rounded-xl border border-border bg-surface p-5"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-bold">{title}</h2>
          <button type="button" className={ghostClass} onClick={onClose}>
            Close
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

export default function VendorMyPluginsPage() {
  const { vendor } = useVendorPortal();
  const { ensureAccessToken } = useAuth();
  const [plugins, setPlugins] = useState<VendorPluginItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showSubmit, setShowSubmit] = useState(false);
  const [preset, setPreset] = useState<SubmitPreset>({});

  const [name, setName] = useState("");
  const [version, setVersion] = useState("1.0.0");
  const [category, setCategory] = useState(PLUGIN_CATEGORIES[0]);
  const [description, setDescription] = useState("");
  const [artifactUrl, setArtifactUrl] = useState("");
  const [sbomUrl, setSbomUrl] = useState("");

  const load = useCallback(async () => {
    if (!vendor) return;
    const data = await marketplaceApi.vendorPlugins(vendor.vendor_id, ensureAccessToken);
    setPlugins(data.plugins);
  }, [vendor, ensureAccessToken]);

  useEffect(() => {
    void load().catch((err: unknown) => {
      setError(err instanceof ApiError ? err.detail : "Could not load your plugins.");
    });
  }, [load]);

  function openSubmit(next: SubmitPreset = {}) {
    setPreset(next);
    setName(next.name ?? "");
    setVersion("1.0.0");
    setCategory(next.category ?? PLUGIN_CATEGORIES[0]);
    setDescription("");
    setArtifactUrl("");
    setSbomUrl("");
    setError(null);
    setShowSubmit(true);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!vendor) return;
    if (!SEMVER_RE.test(version.trim())) {
      setError("Version must be valid semver (e.g. 1.0.0).");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await marketplaceApi.submitPluginBundle(
        vendor.vendor_id,
        {
          name: name.trim(),
          version: version.trim(),
          category,
          description: description.trim() || undefined,
          artifact_url: artifactUrl.trim(),
          sbom_url: sbomUrl.trim() || undefined,
          plugin_id: preset.plugin_id,
        },
        ensureAccessToken,
      );
      setMessage(
        preset.plugin_id
          ? `Submitted v${result.version} for review.`
          : `Submitted ${result.slug} v${result.version} for review.`,
      );
      setShowSubmit(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Submit failed.");
    } finally {
      setBusy(false);
    }
  }

  if (!vendor) return null;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Plugins</h1>
          <p className="mt-1 text-sm text-muted">
            Custom plugins you register and submit for Platform Admin approval.
          </p>
        </div>
        <button type="button" className={buttonClass} onClick={() => openSubmit()}>
          + Submit Plugin
        </button>
      </div>

      <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-foreground">
        Custom plugins require Platform Admin review before you can attach them to products. Standard platform
        plugins do not need approval — activate those from{" "}
        <a href="/app/vendor/platform-plugins" className="font-semibold text-primary hover:underline">
          Platform Plugins
        </a>
        .
      </div>

      {message && <p className="mt-4 text-sm text-primary">{message}</p>}
      {error && !showSubmit && <p className="mt-4 text-sm text-error">{error}</p>}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {plugins.length === 0 ? (
          <p className="col-span-full text-sm text-muted">
            No custom plugins yet. Submit your first plugin to get started.
          </p>
        ) : (
          plugins.map((plugin) => {
            const status = reviewStatusLabel(plugin.latest_version_status);
            return (
              <div key={plugin.plugin_id} className="rounded-xl border border-border bg-surface p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-muted">
                      {plugin.category ? categoryLabel(plugin.category) : "Uncategorized"}
                    </p>
                    <p className="mt-1 font-semibold">{plugin.name}</p>
                    <p className="mt-0.5 font-mono text-[10px] text-muted">{plugin.slug}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${status.className}`}>
                    {status.label}
                  </span>
                </div>
                <p className="mt-2 text-xs text-muted">{plugin.short_description || "No description."}</p>
                {plugin.latest_version && (
                  <p className="mt-2 text-xs text-muted">
                    Latest: v{plugin.latest_version}
                    {plugin.submitted_at ? ` · submitted ${plugin.submitted_at}` : ""}
                  </p>
                )}
                {plugin.latest_version_status === "rejected" && plugin.review_notes && (
                  <div className="mt-3 rounded-lg border border-error/20 bg-error/5 px-3 py-2 text-xs text-error">
                    <p className="font-semibold">Review notes</p>
                    <p className="mt-1">{plugin.review_notes}</p>
                  </div>
                )}
                {plugin.changelog && (
                  <p className="mt-2 text-xs text-muted line-clamp-3">{plugin.changelog}</p>
                )}
                <div className="mt-3 border-t border-border pt-3">
                  <button
                    type="button"
                    className={ghostClass}
                    onClick={() =>
                      openSubmit({
                        plugin_id: plugin.plugin_id,
                        name: plugin.name,
                        category: plugin.category || PLUGIN_CATEGORIES[0],
                      })
                    }
                  >
                    Submit new version
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {showSubmit && (
        <Dialog
          title={preset.plugin_id ? "Submit new version" : "Submit plugin"}
          onClose={() => setShowSubmit(false)}
        >
          <form onSubmit={(e) => void onSubmit(e)} className="space-y-3">
            <label className="block text-xs font-semibold text-muted">
              Name
              <input
                type="text"
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={Boolean(preset.plugin_id)}
                className={inputClass}
              />
            </label>
            <label className="block text-xs font-semibold text-muted">
              Version (semver)
              <input
                type="text"
                required
                value={version}
                onChange={(event) => setVersion(event.target.value)}
                placeholder="1.0.0"
                className={inputClass}
              />
            </label>
            <label className="block text-xs font-semibold text-muted">
              Category
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                disabled={Boolean(preset.plugin_id && preset.category)}
                className={inputClass}
              >
                {PLUGIN_CATEGORIES.map((item) => (
                  <option key={item} value={item}>
                    {categoryLabel(item)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-semibold text-muted">
              Description
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={3}
                className={inputClass}
              />
            </label>
            <label className="block text-xs font-semibold text-muted">
              Artifact URL
              <input
                type="url"
                required
                value={artifactUrl}
                onChange={(event) => setArtifactUrl(event.target.value)}
                placeholder="https://…"
                className={inputClass}
              />
            </label>
            <label className="block text-xs font-semibold text-muted">
              SBOM URL (optional)
              <input
                type="url"
                value={sbomUrl}
                onChange={(event) => setSbomUrl(event.target.value)}
                placeholder="https://…"
                className={inputClass}
              />
            </label>
            {error && <p className="text-sm text-error">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className={ghostClass} onClick={() => setShowSubmit(false)}>
                Cancel
              </button>
              <button type="submit" disabled={busy} className={buttonClass}>
                {busy ? "Submitting…" : "Submit for review"}
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}
