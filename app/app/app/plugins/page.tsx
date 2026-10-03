"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { RequireAuth } from "@/components/auth-guards";
import { useAuth } from "@/components/auth-provider";
import { ApiError, marketplaceApi, vendorApi } from "@/lib/api";
import { clearVendorId, saveVendorId } from "@/lib/session";

type PluginSummary = {
  plugin_id: string;
  name: string;
  slug: string;
  status: string;
  latest_version: string | null;
  latest_version_status: string | null;
};

type OfferingSummary = {
  offering_id: string;
  product_name: string;
  plan_name: string;
  status: string;
};

type PendingReview = {
  version_id: string;
  plugin_slug: string;
  version: string;
  vendor_name: string;
  status: string;
};

const inputClass =
  "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary";
const buttonClass =
  "cursor-pointer rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50";

function PluginsBody() {
  const { ensureAccessToken, profile, ready } = useAuth();
  const isOperator = Boolean(profile?.is_platform_operator);
  const [vendorId, setVendorIdState] = useState<string | null>(null);
  const [vendorLookup, setVendorLookup] = useState<"loading" | "found" | "missing">("loading");
  const [vendorReady, setVendorReady] = useState(false);
  const [plugins, setPlugins] = useState<PluginSummary[]>([]);
  const [offerings, setOfferings] = useState<OfferingSummary[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [pluginId, setPluginId] = useState("");
  const [offeringId, setOfferingId] = useState("");
  const [portal, setPortal] = useState<string | null>(null);
  const [reviews, setReviews] = useState<PendingReview[]>([]);

  useEffect(() => {
    if (!ready) return;
    const orgs = profile?.organizations ?? [];
    let cancelled = false;
    void (async () => {
      for (const org of orgs) {
        try {
          const found = await vendorApi.forOrg(org.org_id, ensureAccessToken);
          if (cancelled) return;
          saveVendorId(found.vendor_id);
          setVendorIdState(found.vendor_id);
          setVendorLookup("found");
          return;
        } catch (err) {
          if (err instanceof ApiError && err.status === 404) continue;
          if (!cancelled) {
            setError(err instanceof ApiError ? err.detail : "Could not load the vendor.");
            setVendorLookup("missing");
          }
          return;
        }
      }
      if (!cancelled) {
        clearVendorId();
        setVendorIdState(null);
        setVendorLookup("missing");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, profile, ensureAccessToken]);

  useEffect(() => {
    if (!ready || !vendorId) {
      if (!vendorId) {
        setVendorReady(false);
        setPortal(null);
      }
      return;
    }
    void marketplaceApi
      .portal(vendorId, ensureAccessToken)
      .then((data) => {
        setVendorReady(true);
        setPortal(
          `${data.status} · ${data.product_count} products · ${data.active_installs} active installs · ${data.pending_plugin_reviews} versions in review`,
        );
      })
      .catch((err: unknown) => {
        setVendorReady(false);
        setPortal(null);
        const detail = err instanceof ApiError ? err.detail : "Could not load the vendor portal.";
        if (err instanceof ApiError && err.status === 403) {
          clearVendorId();
          setVendorIdState(null);
          if (!profile?.is_platform_operator) setError(detail);
          return;
        }
        setError(detail);
      });
  }, [ready, vendorId, ensureAccessToken, profile?.is_platform_operator]);

  useEffect(() => {
    if (!vendorReady || !vendorId) return;
    void Promise.all([
      marketplaceApi.plugins(vendorId, ensureAccessToken),
      marketplaceApi.offerings(vendorId, ensureAccessToken),
    ])
      .then(([pluginData, offeringData]) => {
        setPlugins(pluginData.plugins);
        setOfferings(offeringData.offerings);
      })
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.detail : "Could not load plugins.");
      });
  }, [vendorReady, vendorId, ensureAccessToken, message]);

  useEffect(() => {
    if (!isOperator) return;
    void marketplaceApi
      .pendingReviews(ensureAccessToken)
      .then((data) => setReviews(data.items))
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.detail : "Could not load versions waiting for review.");
      });
  }, [isOperator, ensureAccessToken, message]);

  async function run(key: string, action: () => Promise<string>) {
    setError(null);
    setMessage(null);
    setBusy(key);
    try {
      setMessage(await action());
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Request failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-bold">Plugin and catalog</h1>
      {isOperator && (
        <p className="mt-2 text-sm text-muted">
          Signed in as a platform operator. Approve versions waiting for review here. Submit and publish stay on the vendor owner&apos;s account.
        </p>
      )}
      {vendorReady && <p className="mt-2 text-sm text-muted">{portal}</p>}
      {vendorLookup === "loading" && !isOperator && (
        <p className="mt-2 text-sm text-muted">Loading your vendor…</p>
      )}
      {vendorLookup === "missing" && !vendorReady && !isOperator && (
        <p className="mt-2 text-sm text-muted">
          Register as a vendor first. The vendor id is saved on that page.{" "}
          <Link href="/app/vendor" className="font-semibold text-primary hover:underline">
            Go to vendor registration
          </Link>
        </p>
      )}
      {message && <p className="mt-4 text-sm text-primary">{message}</p>}
      {error && <p className="mt-4 text-sm text-error">{error}</p>}

      {isOperator && (
        <section className="mt-6 space-y-3 rounded-xl border border-border bg-surface p-5">
          <h2 className="font-semibold">Versions waiting for review</h2>
          {reviews.length === 0 && <p className="text-sm text-muted">No versions are waiting.</p>}
          {reviews.map((review) => (
            <div key={review.version_id} className="flex items-center justify-between gap-3 text-sm">
              <p>
                <span className="font-semibold">{review.plugin_slug}</span> {review.version}
                <span className="text-muted"> · {review.vendor_name}</span>
              </p>
              <button
                type="button"
                disabled={busy !== null}
                className={buttonClass}
                onClick={() => {
                  void run("approve", async () => {
                    const decision = await marketplaceApi.decideVersion(
                      review.version_id,
                      "approved",
                      ensureAccessToken,
                    );
                    return `${review.plugin_slug} ${review.version} is ${decision.status}.`;
                  });
                }}
              >
                {busy === "approve" ? "Approving…" : "Approve"}
              </button>
            </div>
          ))}
        </section>
      )}

      {vendorReady && (
        <section className="mt-6 space-y-4 rounded-xl border border-border bg-surface p-5">
          <h2 className="font-semibold">Registered plugins</h2>
          {plugins.length === 0 && <p className="text-sm text-muted">No plugins yet.</p>}
          {plugins.map((plugin) => (
            <p key={plugin.plugin_id} className="text-sm">
              <span className="font-semibold">{plugin.name}</span>
              <span className="text-muted">
                {" "}
                · {plugin.slug} · {plugin.status}
                {plugin.latest_version
                  ? ` · ${plugin.latest_version} ${plugin.latest_version_status}`
                  : ""}
              </span>
            </p>
          ))}
          <h2 className="font-semibold">Offerings</h2>
          {offerings.length === 0 && <p className="text-sm text-muted">No offerings yet.</p>}
          {offerings.map((offering) => (
            <div key={offering.offering_id} className="flex items-center justify-between gap-3 text-sm">
              <p>
                <span className="font-semibold">{offering.product_name}</span>
                <span className="text-muted">
                  {" "}
                  · {offering.plan_name} · {offering.status}
                </span>
              </p>
              {offering.status !== "published" && (
                <button
                  type="button"
                  disabled={busy !== null}
                  className={buttonClass}
                  onClick={() => {
                    void run(`publish-${offering.offering_id}`, async () => {
                      const published = await marketplaceApi.publishOffering(
                        offering.offering_id,
                        ensureAccessToken,
                      );
                      return `${offering.product_name} is ${published.status}.`;
                    });
                  }}
                >
                  {busy === `publish-${offering.offering_id}` ? "Publishing…" : "Publish"}
                </button>
              )}
            </div>
          ))}
        </section>
      )}

      {vendorReady && vendorId && (
      <>
      <form
        className="mt-6 space-y-3 rounded-xl border border-border bg-surface p-5"
        onSubmit={(e: FormEvent<HTMLFormElement>) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          void run("register", async () => {
            const created = await marketplaceApi.registerPlugin(
              vendorId,
              {
                name: String(data.get("name") ?? ""),
                slug: String(data.get("slug") ?? ""),
                category: String(data.get("category") ?? ""),
                short_description: String(data.get("short_description") ?? ""),
              },
              ensureAccessToken,
            );
            setPluginId(created.plugin_id);
            return `Plugin ${created.slug} is ${created.status}.`;
          });
        }}
      >
        <h2 className="font-semibold">Register plugin</h2>
        <input name="name" required placeholder="Plugin name" className={inputClass} />
        <input name="slug" required placeholder="plugin-slug" className={inputClass} />
        <input name="category" required placeholder="category" className={inputClass} />
        <input name="short_description" placeholder="Short description" className={inputClass} />
        <button type="submit" disabled={busy !== null} className={buttonClass}>
          {busy === "register" ? "Registering…" : "Register"}
        </button>
      </form>

      <form
        className="mt-6 space-y-3 rounded-xl border border-border bg-surface p-5"
        onSubmit={(e: FormEvent<HTMLFormElement>) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          const id = String(data.get("plugin_id") || pluginId).trim();
          if (!id) {
            setError("Plugin id is missing. Register a plugin first, or paste its id.");
            return;
          }
          void run("version", async () => {
            const submitted = await marketplaceApi.submitVersion(
              id,
              {
                version: String(data.get("version") ?? ""),
                artifact_url: String(data.get("artifact_url") ?? ""),
                changelog: String(data.get("changelog") ?? ""),
                sbom_url: String(data.get("sbom_url") ?? ""),
              },
              ensureAccessToken,
            );
            const scopes = String(data.get("capabilities") ?? "")
              .split(",")
              .map((scope) => scope.trim())
              .filter(Boolean);
            if (scopes.length > 0) {
              await marketplaceApi.declareCapabilities(
                submitted.version_id,
                scopes.map((scope) => ({ scope, justification: "Declared from the vendor portal" })),
                ensureAccessToken,
              );
            }
            return `Version ${submitted.status}. Capabilities: ${scopes.join(", ") || "none"}.`;
          });
        }}
      >
        <h2 className="font-semibold">Submit version</h2>
        <label className="block text-xs font-semibold text-muted">
          Plugin id
          <input
            name="plugin_id"
            value={pluginId}
            onChange={(e) => setPluginId(e.target.value)}
            placeholder="Filled after Register"
            className={inputClass}
          />
        </label>
        <label className="block text-xs font-semibold text-muted">
          Version
          <input name="version" required placeholder="e.g. 1.0.0" className={inputClass} />
        </label>
        <label className="block text-xs font-semibold text-muted">
          Artifact URL
          <input name="artifact_url" required placeholder="e.g. oci://registry.example/plugin:1.0.0" className={inputClass} />
        </label>
        <label className="block text-xs font-semibold text-muted">
          SBOM URL
          <input name="sbom_url" required placeholder="e.g. https://uploads.example/sbom.json" className={inputClass} />
        </label>
        <label className="block text-xs font-semibold text-muted">
          What changed
          <input name="changelog" placeholder="Optional" className={inputClass} />
        </label>
        <label className="block text-xs font-semibold text-muted">
          Capabilities
          <input name="capabilities" placeholder="e.g. transactions.read, webhooks.publish" className={inputClass} />
        </label>
        <button type="submit" disabled={busy !== null} className={buttonClass}>
          {busy === "version" ? "Submitting…" : "Submit"}
        </button>
      </form>

      <form
        className="mt-6 space-y-3 rounded-xl border border-border bg-surface p-5"
        onSubmit={(e: FormEvent<HTMLFormElement>) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          void run("product", async () => {
            const product = await marketplaceApi.createProduct(
              vendorId ?? "",
              {
                name: String(data.get("name") ?? ""),
                description: String(data.get("description") ?? ""),
                plugin_id: String(data.get("plugin_id") || pluginId),
                fulfilment_type: String(data.get("fulfilment_type") ?? ""),
              },
              ensureAccessToken,
            );
            const offering = await marketplaceApi.createOffering(
              product.product_id,
              {
                plan_name: String(data.get("plan_name") ?? "Pro"),
                billing_period: String(data.get("billing_period") ?? "monthly"),
                price_usd: Number(data.get("price_usd") ?? 0),
              },
              ensureAccessToken,
            );
            setOfferingId(offering.offering_id);
            return `Product ${product.status}. Offering ${offering.offering_id.slice(0, 8)}… is ${offering.status}.`;
          });
        }}
      >
        <h2 className="font-semibold">Create product and offering</h2>
        <p className="text-sm text-muted">
          The same catalog is on{" "}
          <Link href="/app/vendor/products" className="font-semibold text-primary hover:underline">
            Vendor products
          </Link>
          , including edit and archive.
        </p>
        <input name="name" required placeholder="Product name" className={inputClass} />
        <input name="description" placeholder="Description" className={inputClass} />
        <input
          name="plugin_id"
          value={pluginId}
          onChange={(e) => setPluginId(e.target.value)}
          placeholder="Plugin id"
          className={inputClass}
        />
        <select name="fulfilment_type" className={inputClass} defaultValue="PROVISION_SOFTWARE">
          <option value="PROVISION_SOFTWARE">PROVISION_SOFTWARE</option>
          <option value="PROVISION_CLOUD">PROVISION_CLOUD</option>
          <option value="SHIP_PHYSICAL">SHIP_PHYSICAL</option>
          <option value="DELIVER_DIGITAL">DELIVER_DIGITAL</option>
        </select>
        <input name="plan_name" defaultValue="Pro" className={inputClass} />
        <input name="billing_period" defaultValue="monthly" className={inputClass} />
        <input name="price_usd" type="number" defaultValue={49} className={inputClass} />
        <button type="submit" disabled={busy !== null} className={buttonClass}>
          {busy === "product" ? "Creating…" : "Create draft"}
        </button>
      </form>

      <form
        className="mt-6 space-y-3 rounded-xl border border-border bg-surface p-5"
        onSubmit={(e: FormEvent<HTMLFormElement>) => {
          e.preventDefault();
          const id = offeringId.trim();
          if (!id) {
            setError("Create a draft offering first. Publish stays off until that id appears here.");
            return;
          }
          void run("publish", async () => {
            const published = await marketplaceApi.publishOffering(id, ensureAccessToken);
            return `Offering ${published.status}.`;
          });
        }}
      >
        <h2 className="font-semibold">Publish offering</h2>
        <label className="block text-xs font-semibold text-muted">
          Offering id
          <input
            value={offeringId}
            onChange={(e) => setOfferingId(e.target.value)}
            placeholder="Filled after Create draft"
            className={inputClass}
          />
        </label>
        <button type="submit" disabled={busy !== null || offeringId.trim() === ""} className={buttonClass}>
          {busy === "publish" ? "Publishing…" : "Publish"}
        </button>
      </form>
      </>
      )}

      <Link href="/app/marketplace" className="mt-8 inline-block text-sm font-semibold text-primary hover:underline">
        Open the catalog
      </Link>
    </main>
  );
}

export default function PluginsPage() {
  return (
    <RequireAuth>
      <PluginsBody />
    </RequireAuth>
  );
}
