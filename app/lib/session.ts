import type { MeResponse, RefreshResponse, TokenResponse } from "@/lib/api";

const SESSION_KEY = "adan_pradan_session";
const PROFILE_KEY = "adan_pradan_profile";
const PENDING_SIGNUP_KEY = "adan_pradan_pending_signup";
export const SESSION_CHANGE_EVENT = "adan-pradan-session-change";

/** Refresh when fewer than this many ms remain on the access token. */
export const REFRESH_SKEW_MS = 60_000;

export type Session = {
  access_token: string;
  refresh_token: string;
  session_id: string;
  user_id: string;
  principal_id: string;
  expires_at: number;
  tenant_id?: string;
};

export type PendingSignup = {
  email: string;
  tenant_id?: string;
  org_id?: string;
  user_id?: string;
  /** Dev-only OTP returned by the API when email delivery is not wired. */
  dev_otp?: string;
};

function canUseStorage(): boolean {
  return typeof window !== "undefined";
}

function notifySessionChange(): void {
  if (!canUseStorage()) return;
  window.dispatchEvent(new Event(SESSION_CHANGE_EVENT));
}

export function saveSession(token: TokenResponse, tenantId?: string): Session {
  const existing = getSession();
  const session: Session = {
    access_token: token.access_token,
    refresh_token: token.refresh_token,
    session_id: token.session_id,
    user_id: token.user_id,
    principal_id: token.principal_id,
    expires_at: Date.now() + token.expires_in * 1000,
    tenant_id: tenantId ?? existing?.tenant_id,
  };
  if (canUseStorage()) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    notifySessionChange();
  }
  return session;
}

export function applyRefresh(refresh: RefreshResponse): Session | null {
  const existing = getSession();
  if (!existing) return null;
  const session: Session = {
    ...existing,
    access_token: refresh.access_token,
    refresh_token: refresh.refresh_token,
    session_id: refresh.session_id,
    expires_at: Date.now() + refresh.expires_in * 1000,
  };
  if (canUseStorage()) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    notifySessionChange();
  }
  return session;
}

export function setSessionTenantId(tenantId: string): void {
  if (!canUseStorage()) return;
  const existing = getSession();
  if (!existing) return;
  const session = { ...existing, tenant_id: tenantId };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  notifySessionChange();
}

export function getSession(): Session | null {
  if (!canUseStorage()) return null;
  const raw = sessionStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export function saveProfile(profile: MeResponse): void {
  if (!canUseStorage()) return;
  sessionStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  const preferred =
    profile.tenants.find((t) => t.status === "active")?.tenant_id ??
    profile.tenants[0]?.tenant_id;
  if (preferred) {
    setSessionTenantId(preferred);
  } else {
    notifySessionChange();
  }
}

export function getProfile(): MeResponse | null {
  if (!canUseStorage()) return null;
  const raw = sessionStorage.getItem(PROFILE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as MeResponse;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  if (!canUseStorage()) return;
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(PROFILE_KEY);
  notifySessionChange();
}

export function savePendingSignup(pending: PendingSignup): void {
  if (!canUseStorage()) return;
  sessionStorage.setItem(PENDING_SIGNUP_KEY, JSON.stringify(pending));
}

export function getPendingSignup(): PendingSignup | null {
  if (!canUseStorage()) return null;
  const raw = sessionStorage.getItem(PENDING_SIGNUP_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PendingSignup;
  } catch {
    return null;
  }
}

export function clearPendingSignup(): void {
  if (!canUseStorage()) return;
  sessionStorage.removeItem(PENDING_SIGNUP_KEY);
}

const VENDOR_ID_KEY = "adan_pradan_vendor_id";

export function saveVendorId(vendorId: string): void {
  if (!canUseStorage()) return;
  sessionStorage.setItem(VENDOR_ID_KEY, vendorId);
}

export function getVendorId(): string | null {
  if (!canUseStorage()) return null;
  return sessionStorage.getItem(VENDOR_ID_KEY);
}

export function clearVendorId(): void {
  if (!canUseStorage()) return;
  sessionStorage.removeItem(VENDOR_ID_KEY);
}

export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "AP";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}
