"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ApiError, authApi, type MeResponse } from "@/lib/api";
import {
  REFRESH_SKEW_MS,
  SESSION_CHANGE_EVENT,
  applyRefresh,
  clearSession,
  getProfile,
  getSession,
  saveProfile,
  type Session,
} from "@/lib/session";

type AuthContextValue = {
  ready: boolean;
  signedIn: boolean;
  session: Session | null;
  profile: MeResponse | null;
  tenantId: string | null;
  bootstrap: () => Promise<void>;
  ensureAccessToken: (force?: boolean) => Promise<string | null>;
  refreshProfile: () => Promise<MeResponse | null>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<MeResponse | null>(null);
  const refreshInFlight = useRef<Promise<string | null> | null>(null);

  const syncFromStorage = useCallback(() => {
    setSession(getSession());
    setProfile(getProfile());
  }, []);

  const ensureAccessToken = useCallback(async (force = false): Promise<string | null> => {
    const current = getSession();
    if (!current) return null;

    const needsRefresh = force || current.expires_at - Date.now() <= REFRESH_SKEW_MS;
    if (!needsRefresh) return current.access_token;

    if (refreshInFlight.current) return refreshInFlight.current;

    refreshInFlight.current = (async () => {
      try {
        const refreshed = await authApi.refresh({
          refresh_token: current.refresh_token,
          session_id: current.session_id,
        });
        const next = applyRefresh(refreshed);
        setSession(next);
        return next?.access_token ?? null;
      } catch {
        clearSession();
        setSession(null);
        setProfile(null);
        return null;
      } finally {
        refreshInFlight.current = null;
      }
    })();

    return refreshInFlight.current;
  }, []);

  const refreshProfile = useCallback(async (): Promise<MeResponse | null> => {
    const token = await ensureAccessToken();
    if (!token) return null;
    try {
      const me = await authApi.me(token);
      saveProfile(me);
      setProfile(me);
      setSession(getSession());
      return me;
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        // Try one refresh then retry /me once.
        const current = getSession();
        if (current) {
          try {
            const refreshed = await authApi.refresh({
              refresh_token: current.refresh_token,
              session_id: current.session_id,
            });
            applyRefresh(refreshed);
            const me = await authApi.me(getSession()!.access_token);
            saveProfile(me);
            setProfile(me);
            setSession(getSession());
            return me;
          } catch {
            /* fall through */
          }
        }
        clearSession();
        setSession(null);
        setProfile(null);
      }
      return null;
    }
  }, [ensureAccessToken]);

  const bootstrap = useCallback(async () => {
    const current = getSession();
    if (!current) {
      setSession(null);
      setProfile(null);
      setReady(true);
      return;
    }
    setSession(current);
    setProfile(getProfile());
    await refreshProfile();
    setReady(true);
  }, [refreshProfile]);

  const signOut = useCallback(async () => {
    const current = getSession();
    if (current?.access_token) {
      try {
        await authApi.logout(current.access_token);
      } catch {
        /* clear local session anyway */
      }
    }
    clearSession();
    setSession(null);
    setProfile(null);
  }, []);

  useEffect(() => {
    void bootstrap();
    const onChange = () => syncFromStorage();
    window.addEventListener(SESSION_CHANGE_EVENT, onChange);
    return () => window.removeEventListener(SESSION_CHANGE_EVENT, onChange);
  }, [bootstrap, syncFromStorage]);

  const value = useMemo<AuthContextValue>(
    () => ({
      ready,
      signedIn: Boolean(session?.access_token),
      session,
      profile,
      tenantId: session?.tenant_id ?? profile?.tenants[0]?.tenant_id ?? null,
      bootstrap,
      ensureAccessToken,
      refreshProfile,
      signOut,
    }),
    [ready, session, profile, bootstrap, ensureAccessToken, refreshProfile, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
