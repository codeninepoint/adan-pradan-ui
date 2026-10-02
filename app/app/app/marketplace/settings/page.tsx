"use client";

import { useAuth } from "@/components/auth-provider";

export default function BuyerSettingsPage() {
  const { profile } = useAuth();
  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold">Settings</h1>
      <p className="mt-1 text-sm text-muted">
        Display preferences live in the header theme control. This page shows the signed-in profile.
      </p>
      <dl className="mt-6 space-y-3 rounded-xl border border-border bg-surface p-4 text-sm">
        <div>
          <dt className="text-xs font-semibold uppercase text-muted">Name</dt>
          <dd>{profile?.display_name || "—"}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase text-muted">Email</dt>
          <dd>{profile?.email || "—"}</dd>
        </div>
      </dl>
    </div>
  );
}
