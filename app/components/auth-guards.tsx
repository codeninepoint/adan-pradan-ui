"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { ready, signedIn } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (ready && !signedIn) {
      router.replace("/login");
    }
  }, [ready, signedIn, router]);

  if (!ready) {
    return (
      <div className="flex flex-1 items-center justify-center bg-background text-sm text-muted">
        Loading session…
      </div>
    );
  }

  if (!signedIn) {
    return (
      <div className="flex flex-1 items-center justify-center bg-background text-sm text-muted">
        Redirecting to sign in…
      </div>
    );
  }

  return <>{children}</>;
}

export function RedirectIfAuthenticated({
  children,
  to = "/app",
}: {
  children: ReactNode;
  to?: string;
}) {
  const { ready, signedIn } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (ready && signedIn) {
      router.replace(to);
    }
  }, [ready, signedIn, router, to]);

  if (!ready) {
    return (
      <div className="flex flex-1 items-center justify-center bg-background text-sm text-muted">
        Loading…
      </div>
    );
  }

  if (signedIn) {
    return (
      <div className="flex flex-1 items-center justify-center bg-background text-sm text-muted">
        Redirecting…
      </div>
    );
  }

  return <>{children}</>;
}
