"use client";

import { ReactNode } from "react";
import { RequireAuth } from "@/components/auth-guards";
import { StorefrontShell } from "@/components/marketplace/shell";

export default function MarketplaceLayout({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <StorefrontShell>{children}</StorefrontShell>
    </RequireAuth>
  );
}
