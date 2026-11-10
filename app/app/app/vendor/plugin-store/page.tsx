"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { useVendorPortal } from "@/components/vendor/portal";
import { ApiError, marketplaceApi, VendorGrowthPluginItem } from "@/lib/api";

const ACCENTS: Record<string, { badge: string; button: string; chip: string }> = {
  "sales-pipeline": {
    badge: "bg-amber-500/15 text-amber-600",
    button: "bg-amber-500 text-white hover:bg-amber-600",
    chip: "text-amber-600",
  },
  "digital-marketing": {
    badge: "bg-sky-500/15 text-sky-600",
    button: "bg-sky-500 text-white hover:bg-sky-600",
    chip: "text-sky-600",
  },
  publicity: {
    badge: "bg-violet-500/15 text-violet-600",
    button: "bg-violet-500 text-white hover:bg-violet-600",
    chip: "text-violet-600",
  },
};

const STEPS = ["Data", "Connect", "Modules", "Confirm"];

const inputClass =
  "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary";
const ghostClass =
  "cursor-pointer rounded-lg border border-border px-4 py-2 text-sm font-semibold disabled:opacity-50";

function Toggle({
  checked,
  disabled,
  onChange,
  label,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        checked ? "bg-emerald-500" : "bg-border"
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? "left-[22px]" : "left-0.5"}`}
      />
    </button>
  );
}

export default function VendorPluginStorePage() {
  const { vendor } = useVendorPortal();
  const { profile, ensureAccessToken } = useAuth();
  const [items, setItems] = useState<VendorGrowthPluginItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [wizardKey, setWizardKey] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [dataConsent, setDataConsent] = useState(false);
  const [transferConsent, setTransferConsent] = useState(false);
  const [businessName, setBusinessName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [gst, setGst] = useState("");
  const [affiliateTerms, setAffiliateTerms] = useState(false);
  const [moduleChoices, setModuleChoices] = useState<Record<string, boolean>>({});
  const [termsConfirmed, setTermsConfirmed] = useState(false);

  const load = useCallback(async () => {
    if (!vendor) return;
    const data = await marketplaceApi.vendorGrowthPlugins(vendor.vendor_id, ensureAccessToken);
    setItems(data.items);
  }, [vendor, ensureAccessToken]);

  useEffect(() => {
    void load().catch((err: unknown) =>
      setError(err instanceof ApiError ? err.detail : "Could not load the plugin store."),
    );
  }, [load]);

  const wizardPlugin = items.find((item) => item.key === wizardKey) ?? null;

  function openWizard(item: VendorGrowthPluginItem) {
    setWizardKey(item.key);
    setStep(0);
    setDataConsent(false);
    setTransferConsent(false);
    setTermsConfirmed(false);
    setAffiliateTerms(Boolean(item.connection?.affiliate_terms_accepted));
    setBusinessName(String(item.connection?.business_display_name || vendor?.legal_name || ""));
    setContactEmail(String(item.connection?.contact_email || profile?.email || ""));
    setGst(String(item.connection?.gst_or_business_id || ""));
    setModuleChoices(
      Object.fromEntries(item.vendor_modules.map((module) => [module.key, module.enabled])),
    );
    setError(null);
  }

  async function activate() {
    if (!vendor || !wizardPlugin) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await marketplaceApi.importGrowthPlugin(
        vendor.vendor_id,
        wizardPlugin.key,
        {
          consents: {
            data_processing: dataConsent,
            third_party_transfer: transferConsent,
            terms_confirmed: termsConfirmed,
          },
          connection: {
            business_display_name: businessName,
            contact_email: contactEmail,
            gst_or_business_id: gst,
            affiliate_terms_accepted: affiliateTerms,
          },
          modules: wizardPlugin.vendor_modules.map((module) => ({
            key: module.key,
            label: module.label,
            enabled: Boolean(moduleChoices[module.key]),
          })),
        },
        ensureAccessToken,
      );
      setItems((current) => current.map((item) => (item.key === updated.key ? updated : item)));
      setWizardKey(null);
      setMessage(
        updated.key === "sales-pipeline"
          ? "Sales Pipeline is active — open it from Active Plugins to see your board."
          : `${updated.name} is active for your storefront.`,
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Could not activate this plugin.");
    } finally {
      setBusy(false);
    }
  }

  if (!vendor) return null;

  const stepValid =
    step === 0
      ? dataConsent && transferConsent
      : step === 1
        ? businessName.trim().length > 0 && contactEmail.includes("@")
        : step === 2
          ? true
          : termsConfirmed;

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">Plugin Store</p>
      <h1 className="mt-1 text-2xl font-bold tracking-tight">Standard Plugins</h1>
      <p className="mt-1 text-sm text-muted">
        Platform-built, zero-code modules ready to activate for your storefront
      </p>

      <div className="mt-5 rounded-xl border border-primary/25 bg-[var(--hero-tint)] px-4 py-4">
        <p className="font-bold text-foreground">✦ Standard Plugin Guarantee</p>
        <p className="mt-1 text-sm text-muted">
          All Standard Plugins are built and maintained by AdanPradan. Automatic updates, uptime
          guarantee, full data portability, and no vendor lock-in.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
          <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-emerald-600">✓ Platform-Maintained</span>
          <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-emerald-600">Free to Import</span>
          <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-emerald-600">Auto-Updates</span>
          <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-emerald-600">99.9% Uptime SLA</span>
        </div>
      </div>

      {message && <p className="mt-4 text-sm font-semibold text-emerald-600">{message}</p>}
      {error && !wizardPlugin && <p className="mt-4 text-sm text-error">{error}</p>}

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {items.map((item) => {
          const accent = ACCENTS[item.key] ?? ACCENTS["sales-pipeline"];
          const imported = item.installation_status === "active";
          return (
            <article key={item.key} className="flex flex-col rounded-xl border border-border bg-surface p-5">
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-bold">{item.name}</h2>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${accent.badge}`}>
                  ◆ Standard
                </span>
              </div>
              <p className="mt-1 text-xs text-muted">{item.description}</p>
              <p className="mt-4 text-[10px] font-bold uppercase tracking-widest text-muted">
                {item.modules.length} modules included
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {item.modules.map((module) => (
                  <span key={module.key} className="rounded-md bg-background px-2 py-1 text-[11px] text-muted">
                    {module.label.replace(" & Scoring", "").replace(" (Meta / Google / TikTok)", "")}
                  </span>
                ))}
              </div>
              <div className="mt-5 grid grid-cols-3 gap-2 border-t border-border pt-4 text-center">
                <div>
                  <p className={`font-bold ${accent.chip}`}>{item.vendors_using.toLocaleString("en-IN")}</p>
                  <p className="text-[10px] uppercase tracking-wide text-muted">Vendors using</p>
                </div>
                <div>
                  <p className={`font-bold ${accent.chip}`}>{item.rating.toFixed(1)}★</p>
                  <p className="text-[10px] uppercase tracking-wide text-muted">Rating</p>
                </div>
                <div>
                  <p className={`font-bold ${accent.chip}`}>{item.price_label}</p>
                  <p className="text-[10px] uppercase tracking-wide text-muted">Price</p>
                </div>
              </div>
              <div className="mt-5 flex gap-2">
                <Link href="/app/vendor/plugin-settings" className={`${ghostClass} flex-1 text-center`}>
                  Details
                </Link>
                {imported ? (
                  item.key === "sales-pipeline" || item.key === "digital-marketing" || item.key === "publicity" ? (
                    <Link
                      href={
                        item.key === "sales-pipeline"
                          ? "/app/vendor/sales-pipeline"
                          : item.key === "digital-marketing"
                            ? "/app/vendor/digital-marketing"
                            : "/app/vendor/publicity"
                      }
                      className={`flex-1 rounded-lg px-4 py-2 text-center text-sm font-bold ${accent.button}`}
                    >
                      {item.key === "sales-pipeline" ? "Open Board" : item.key === "digital-marketing" ? "Open Dashboard" : "Open Studio"}
                    </Link>
                  ) : (
                    <span className="flex-1 rounded-lg bg-emerald-500/15 px-4 py-2 text-center text-sm font-bold text-emerald-600">
                      ✓ Imported
                    </span>
                  )
                ) : (
                  <button
                    type="button"
                    disabled={!item.platform_enabled}
                    onClick={() => openWizard(item)}
                    className={`flex-1 cursor-pointer rounded-lg px-4 py-2 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50 ${accent.button}`}
                  >
                    {item.platform_enabled ? "Import Plugin" : "Disabled by Admin"}
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {wizardPlugin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-surface p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-bold">Import: {wizardPlugin.name}</h2>
                <p className="text-xs text-muted">Complete 4 quick steps to activate</p>
              </div>
              <button type="button" aria-label="Close import wizard" onClick={() => setWizardKey(null)} className="cursor-pointer rounded-lg border border-border px-2 py-1 text-sm">
                ✕
              </button>
            </div>

            <ol className="mt-6 flex items-center">
              {STEPS.map((label, index) => (
                <li key={label} className={`flex items-center ${index < STEPS.length - 1 ? "flex-1" : ""}`}>
                  <div className="flex flex-col items-center">
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                        index < step
                          ? "bg-emerald-500 text-white"
                          : index === step
                            ? "bg-primary text-primary-foreground"
                            : "bg-background text-muted"
                      }`}
                    >
                      {index < step ? "✓" : index + 1}
                    </span>
                    <span className={`mt-1 text-[9px] font-bold uppercase tracking-wide ${index <= step ? "text-primary" : "text-muted"}`}>
                      {label}
                    </span>
                  </div>
                  {index < STEPS.length - 1 && (
                    <span className={`mx-2 mb-4 h-0.5 flex-1 ${index < step ? "bg-emerald-500" : "bg-border"}`} />
                  )}
                </li>
              ))}
            </ol>

            {step === 0 && (
              <div className="mt-4 space-y-3">
                <div className="rounded-xl border border-border bg-background p-4">
                  <p className="text-sm font-bold">🔒 Data Processing Consent</p>
                  <p className="mt-1 text-xs text-muted">
                    This plugin will process your lead, sales, and customer data within the AdanPradan
                    platform. Data is not shared with third parties. You retain full ownership and can
                    export at any time.
                  </p>
                  <label className="mt-3 flex cursor-pointer items-start gap-2 text-xs">
                    <input type="checkbox" checked={dataConsent} onChange={(e) => setDataConsent(e.target.checked)} className="mt-0.5" />
                    I consent to AdanPradan processing my business data as described above
                  </label>
                </div>
                <div className="rounded-xl border border-border bg-background p-4">
                  <p className="text-sm font-bold">🌐 Third-Party Data Transfer</p>
                  <p className="mt-1 text-xs text-muted">
                    Some modules (e.g. Ad integrations) may transfer campaign data to Meta, Google, or
                    WhatsApp APIs. You control which channels are connected.
                  </p>
                  <label className="mt-3 flex cursor-pointer items-start gap-2 text-xs">
                    <input type="checkbox" checked={transferConsent} onChange={(e) => setTransferConsent(e.target.checked)} className="mt-0.5" />
                    I understand and accept third-party data transfer terms where applicable
                  </label>
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="mt-4 space-y-3">
                <label className="block text-xs font-bold uppercase tracking-wide text-muted">
                  Business display name
                  <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} className={inputClass} />
                </label>
                <label className="block text-xs font-bold uppercase tracking-wide text-muted">
                  Primary contact email
                  <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className={inputClass} />
                </label>
                <label className="block text-xs font-bold uppercase tracking-wide text-muted">
                  GST / Business ID (optional)
                  <input value={gst} onChange={(e) => setGst(e.target.value)} placeholder="27AAPCI234F1Z5" className={inputClass} />
                </label>
                <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4">
                  <p className="text-sm font-bold text-amber-600">⚠ Affiliate Programme Terms</p>
                  <p className="mt-1 text-xs text-muted">
                    If you use the Affiliate Manager module, all commission payouts follow the AdanPradan
                    Affiliate Policy v2.4. Minimum payout threshold: ₹500.
                  </p>
                  <label className="mt-3 flex cursor-pointer items-start gap-2 text-xs">
                    <input type="checkbox" checked={affiliateTerms} onChange={(e) => setAffiliateTerms(e.target.checked)} className="mt-0.5" />
                    I accept the Affiliate Programme Terms
                  </label>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="mt-4">
                <p className="text-xs text-muted">
                  Choose which modules to activate. You can change this anytime in Plugin Settings.
                </p>
                <div className="mt-3 divide-y divide-border rounded-xl border border-border">
                  {wizardPlugin.vendor_modules.map((module) => (
                    <div key={module.key} className="flex items-center justify-between gap-3 px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold">
                          {module.label}
                          {module.badge && (
                            <span className="ml-2 rounded-full bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-bold text-violet-600">
                              {module.badge}
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-muted">
                          {module.platform_enabled ? module.description : "Disabled by your platform admin"}
                        </p>
                      </div>
                      <Toggle
                        label={module.label}
                        checked={Boolean(moduleChoices[module.key])}
                        disabled={!module.platform_enabled}
                        onChange={(next) => setModuleChoices((c) => ({ ...c, [module.key]: next }))}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="mt-4 text-center">
                <p className="text-3xl">✦</p>
                <h3 className="mt-2 font-bold">{wizardPlugin.name}</h3>
                <p className="mt-1 text-xs text-muted">
                  Everything is set up. Click Activate Plugin to add it to your vendor portal. You&apos;ll
                  see it in your sidebar instantly.
                </p>
                <div className="mt-4 rounded-xl border border-border bg-background p-4 text-left">
                  <p className="text-sm font-bold">✓ Summary</p>
                  <p className="mt-1 text-xs text-muted">
                    Activating with {wizardPlugin.vendor_modules.filter((m) => moduleChoices[m.key]).length} of{" "}
                    {wizardPlugin.vendor_modules.length} modules enabled. Policies accepted. No additional
                    cost — this is a Standard Plugin.
                  </p>
                </div>
                <label className="mt-4 flex cursor-pointer items-start gap-2 text-left text-xs">
                  <input type="checkbox" checked={termsConfirmed} onChange={(e) => setTermsConfirmed(e.target.checked)} className="mt-0.5" />
                  I confirm I have read and agree to all terms presented in this wizard
                </label>
              </div>
            )}

            {error && <p className="mt-4 text-sm text-error">{error}</p>}

            <div className="mt-6 flex items-center justify-between">
              <button
                type="button"
                disabled={step === 0 || busy}
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                className={`${ghostClass} ${step === 0 ? "invisible" : ""}`}
              >
                ← Back
              </button>
              {step < 3 ? (
                <button
                  type="button"
                  disabled={!stepValid}
                  onClick={() => setStep((s) => s + 1)}
                  className="cursor-pointer rounded-lg bg-primary px-5 py-2 text-sm font-bold text-primary-foreground hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next →
                </button>
              ) : (
                <button
                  type="button"
                  disabled={!stepValid || busy}
                  onClick={() => void activate()}
                  className="cursor-pointer rounded-lg bg-primary px-5 py-2 text-sm font-bold text-primary-foreground hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy ? "Activating…" : "Activate Plugin"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
