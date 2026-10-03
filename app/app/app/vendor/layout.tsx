"use client";

import { ReactNode } from "react";
import { RequireAuth } from "@/components/auth-guards";
import { VendorChrome, VendorPortalProvider } from "@/components/vendor/portal";

export default function VendorLayout({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <VendorPortalProvider>
        <VendorChrome>{children}</VendorChrome>
      </VendorPortalProvider>
    </RequireAuth>
  );
}
