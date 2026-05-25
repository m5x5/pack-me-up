import { createContext, ReactNode, useContext, useState, useEffect, useRef } from "react";
import { Session, type SessionStateChangeDetail } from "@uvdsl/solid-oidc-client-browser";
import { isAuthenticationError } from "../services/solidPod";
import { AUTH_RETURN_TO_KEY } from "../pages/solid-pod-handle-redirect-page";
import { AppSession } from "../types/AppSession";

interface SolidPodContextValue {
  session: AppSession | null;
  isLoggedIn: boolean;
  sessionExpired: boolean;
  clearSessionExpired: () => void;
  webId: string | undefined;
  isLoading: boolean;
  login: (oidcIssuer: string, returnTo?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const SolidPodContext = createContext<SolidPodContextValue | undefined>(undefined);

export function SolidPodProvider({ children }: { children: ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [webId, setWebId] = useState<string | undefined>(undefined);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const intentionalLogoutRef = useRef(false);

  const uvdslSessionRef = useRef<InstanceType<typeof Session>>(null!);
  if (!uvdslSessionRef.current) {
    const origin = window.location.origin || window.location.href?.split("?")[0]?.split("#")[0] || "http://localhost";
    uvdslSessionRef.current = new Session(
      {
        redirect_uris: [new URL("/pod-auth-callback.html", origin).toString()],
        client_name: "Pack Me Up",
      },
      {
        onSessionStateChange: (e) => {
          const { isActive, webId: newWebId } = (e as CustomEvent<SessionStateChangeDetail>).detail;
          setIsLoggedIn(isActive);
          setWebId(isActive ? newWebId : undefined);
          if (isActive) setSessionExpired(false);
        },
        onSessionExpiration: () => {
          if (!intentionalLogoutRef.current) setSessionExpired(true);
          setIsLoggedIn(false);
          setWebId(undefined);
          intentionalLogoutRef.current = false;
        },
      }
    );
  }

  const uvdslSession = uvdslSessionRef.current;

  const appSession: AppSession | null = isLoggedIn
    ? { fetch: uvdslSession.authFetch.bind(uvdslSession), info: { isLoggedIn, webId } }
    : null;

  useEffect(() => {
    const initializeSession = async () => {
      try {
        console.log("Initializing Solid session...");

        const searchParams = new URLSearchParams(window.location.search);
        const isOAuthCallback = searchParams.has("code") || searchParams.has("state");

        if (!isOAuthCallback) {
          sessionStorage.setItem(AUTH_RETURN_TO_KEY, window.location.hash.substring(1) || "/");
        }

        await uvdslSession.handleRedirectFromLogin();

        if (!uvdslSession.isActive) {
          try {
            await uvdslSession.restore();
          } catch {
            // No saved session — user starts logged out
          }
        }

        console.log("Session initialized:", { isActive: uvdslSession.isActive, webId: uvdslSession.webId });
      } catch (error) {
        console.error("Error initializing session:", error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeSession();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Validate session when user returns to the tab
  useEffect(() => {
    if (!isLoggedIn || !webId) return;

    const handleSessionExpired = async () => {
      console.log("Session validation failed - session has expired");
      await uvdslSession.logout();
      setIsLoggedIn(false);
      setWebId(undefined);
      setSessionExpired(true);
    };

    const validateSession = async () => {
      try {
        const response = await uvdslSession.authFetch(webId, { method: "HEAD" });
        if (response.status === 401 || response.status === 403) {
          await handleSessionExpired();
        }
      } catch (error: unknown) {
        if (isAuthenticationError(error)) {
          await handleSessionExpired();
        } else {
          console.error("Session validation failed with non-auth error:", error);
        }
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        console.log("Tab became visible - validating session");
        validateSession();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [isLoggedIn, webId]); // eslint-disable-line react-hooks/exhaustive-deps

  const login = async (oidcIssuer: string, returnTo?: string) => {
    const currentLocation = returnTo || window.location.hash.substring(1) || "/";
    const redirectUrl = new URL("/pod-auth-callback.html", window.location.href);
    redirectUrl.searchParams.set("returnTo", currentLocation);
    await uvdslSession.login(oidcIssuer, redirectUrl.toString());
  };

  const logout = async () => {
    intentionalLogoutRef.current = true;
    await uvdslSession.logout();
    setIsLoggedIn(false);
    setWebId(undefined);
  };

  const clearSessionExpired = () => setSessionExpired(false);

  const value: SolidPodContextValue = {
    session: appSession,
    isLoggedIn,
    sessionExpired,
    clearSessionExpired,
    webId,
    isLoading,
    login,
    logout,
  };

  return (
    <SolidPodContext.Provider value={value}>
      {children}
    </SolidPodContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSolidPod() {
  const context = useContext(SolidPodContext);

  if (context === undefined) {
    throw new Error("useSolidPod must be used within a SolidPodProvider");
  }

  return context;
}
