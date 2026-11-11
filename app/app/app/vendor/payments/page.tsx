"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function VendorPaymentsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/app/vendor/settlement");
  }, [router]);

  return (
    <main className="mx-auto max-w-lg px-4 py-16 text-center sm:px-6">
      <p className="text-sm text-muted">Redirecting to Settlement…</p>
      <Link href="/app/vendor/settlement" className="mt-3 inline-block text-sm font-semibold text-primary hover:underline">
        Open Settlement
      </Link>
    </main>
  );
}
