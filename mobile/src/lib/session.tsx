// Who is signed in. The token lives in the secure storage; on start it is checked against core-api
// (GET /api/auth/me). Without network the app still opens with the saved token: receipts are queued
// on the phone anyway, and a stale token is caught by the first 401.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ApiError, coreFetch } from "@/api/fetcher";
import { authToken } from "@/lib/token";

export interface User {
  id: string;
  email: string;
  displayName: string | null;
}

type Status = "loading" | "signedOut" | "signedIn";

interface Session {
  status: Status;
  user: User | null;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
}

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<Status>("loading");
  const [user, setUser] = useState<User | null>(null);

  const signOut = useCallback(async () => {
    await authToken.clear();
    queryClient.clear();
    setUser(null);
    setStatus("signedOut");
  }, [queryClient]);

  useEffect(() => {
    authToken.setUnauthorizedHandler(() => void signOut());
  }, [signOut]);

  useEffect(() => {
    (async () => {
      if (!(await authToken.load())) return setStatus("signedOut");
      try {
        const me = await coreFetch<{ user: User }>("/api/auth/me");
        setUser(me.user);
        setStatus("signedIn");
      } catch (err) {
        // 401 is handled by signOut above; no network → keep the session
        if (err instanceof ApiError && err.status === 0) setStatus("signedIn");
      }
    })();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const res = await coreFetch<{ token: string; user: User }>("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), password }),
    });
    await authToken.save(res.token);
    setUser(res.user);
    setStatus("signedIn");
  }, []);

  const value = useMemo(() => ({ status, user, signIn, signOut }), [status, user, signIn, signOut]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const s = useContext(SessionContext);
  if (!s) throw new Error("useSession outside SessionProvider");
  return s;
}
