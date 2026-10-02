"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { marketplaceApi } from "@/lib/api";

export default function InstallsPage() {
  const { tenantId, ensureAccessToken } = useAuth();
  const [items, setItems] = useState<{ entitlement_id: string; offering: string; installation_status: string }[]>([]);

  useEffect(() => {
    if (!tenantId) return;
    void marketplaceApi.entitlements(tenantId, ensureAccessToken).then((data) => setItems(data.entitlements));
  }, [tenantId, ensureAccessToken]);

  return (
    <div>
      <h1 className="text-2xl font-bold">My installs</h1>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-muted">Nothing installed in this tenant.</p>
      ) : (
        <ul className="mt-4 space-y-2 text-sm">
          {items.map((item) => (
            <li key={item.entitlement_id} className="rounded-xl border border-border bg-surface p-4">
              <span className="font-semibold">{item.offering}</span>
              <span className="text-muted"> · {item.installation_status}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
