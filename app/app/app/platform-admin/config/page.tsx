"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { ApiError, platformAdminApi } from "@/lib/api";

const btnPrimary =
  "cursor-pointer rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50";

const fieldClass = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";

export default function ConfigPage() {
  const { ensureAccessToken } = useAuth();
  const [platformName, setPlatformName] = useState("");
  const [commissionRate, setCommissionRate] = useState("");
  const [settlementCycle, setSettlementCycle] = useState("");
  const [pluginReviewSla, setPluginReviewSla] = useState("");
  const [webhookHmacKey, setWebhookHmacKey] = useState("");
  const [productReviewRequired, setProductReviewRequired] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const data = await platformAdminApi.config(ensureAccessToken);
    const v = data.values;
    setPlatformName(String(v.platform_name ?? ""));
    setCommissionRate(String(v.commission_rate_pct ?? ""));
    setSettlementCycle(String(v.settlement_cycle ?? ""));
    setPluginReviewSla(String(v.plugin_review_sla_days ?? ""));
    setWebhookHmacKey(String(v.webhook_hmac_key ?? ""));
    setProductReviewRequired(Boolean(v.product_content_review_required));
  }, [ensureAccessToken]);

  useEffect(() => {
    void load().catch((err: unknown) => {
      setError(err instanceof ApiError ? err.detail : "Could not load config.");
    });
  }, [load]);

  async function save() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await platformAdminApi.patchConfig(
        {
          platform_name: platformName,
          commission_rate_pct: Number(commissionRate),
          settlement_cycle: settlementCycle,
          plugin_review_sla_days: Number(pluginReviewSla),
          webhook_hmac_key: webhookHmacKey,
          product_content_review_required: productReviewRequired,
        },
        ensureAccessToken,
      );
      setMessage("Configuration saved.");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-extrabold tracking-tight">Config</h1>
      <p className="mt-1 text-sm text-muted">Platform-wide configuration values.</p>

      <form
        className="mt-6 space-y-4 rounded-xl border border-border bg-surface p-5"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <label className="block">
          <span className="text-xs font-semibold uppercase text-muted">Platform name</span>
          <input
            value={platformName}
            onChange={(e) => setPlatformName(e.target.value)}
            className={`mt-1 ${fieldClass}`}
          />
        </label>

        <label className="block">
          <span className="text-xs font-semibold uppercase text-muted">Commission rate (%)</span>
          <input
            type="number"
            value={commissionRate}
            onChange={(e) => setCommissionRate(e.target.value)}
            className={`mt-1 ${fieldClass}`}
          />
        </label>

        <label className="block">
          <span className="text-xs font-semibold uppercase text-muted">Settlement cycle</span>
          <input
            value={settlementCycle}
            onChange={(e) => setSettlementCycle(e.target.value)}
            placeholder="weekly_t7"
            className={`mt-1 ${fieldClass}`}
          />
        </label>

        <label className="block">
          <span className="text-xs font-semibold uppercase text-muted">Plugin review SLA (days)</span>
          <input
            type="number"
            value={pluginReviewSla}
            onChange={(e) => setPluginReviewSla(e.target.value)}
            className={`mt-1 ${fieldClass}`}
          />
        </label>

        <label className="block">
          <span className="text-xs font-semibold uppercase text-muted">Webhook HMAC key</span>
          <input
            value={webhookHmacKey}
            onChange={(e) => setWebhookHmacKey(e.target.value)}
            type="password"
            className={`mt-1 ${fieldClass}`}
          />
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={productReviewRequired}
            onChange={(e) => setProductReviewRequired(e.target.checked)}
            className="rounded border-border"
          />
          <span className="text-sm">Product content review required</span>
        </label>

        <button type="submit" className={btnPrimary} disabled={busy}>
          Save
        </button>
      </form>

      {message && <p className="mt-4 text-sm text-primary">{message}</p>}
      {error && <p className="mt-4 text-sm text-error">{error}</p>}
    </main>
  );
}
