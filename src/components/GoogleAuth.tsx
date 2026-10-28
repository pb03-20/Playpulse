import { useEffect, useRef, useState } from "react";
import { LogOut, User as UserIcon } from "lucide-react";

export interface GoogleUserProfile {
  email: string;
  name: string;
  picture?: string;
  sub: string;
}

interface GoogleAuthProps {
  onUserChange?: (user: GoogleUserProfile | null) => void;
  clientId?: string;
}

const DEFAULT_CLIENT_ID =
  "775526888744-a6jrerd46hi3848agjiqn9uo768nj9nj.apps.googleusercontent.com";


// Decode Google JWT credential token without extra dependencies
function parseJwt(token: string): GoogleUserProfile | null {
  try {
    const base64Url = token.split(".")[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join(""),
    );
    const parsed = JSON.parse(jsonPayload);
    return {
      email: parsed.email,
      name: parsed.name || parsed.email.split("@")[0],
      picture: parsed.picture,
      sub: parsed.sub,
    };
  } catch (err) {
    console.error("[GoogleAuth] Failed to parse JWT:", err);
    return null;
  }
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (res: { credential: string }) => void;
            auto_select?: boolean;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              theme?: "outline" | "filled_blue" | "filled_black";
              size?: "large" | "medium" | "small";
              type?: "standard" | "icon";
              shape?: "rectangular" | "pill" | "circle" | "square";
              text?: "signin_with" | "signup_with" | "continue_with" | "signin";
              logo_alignment?: "left" | "center";
              width?: number;
            },
          ) => void;
          prompt: () => void;
        };
      };
    };
  }
}

export function GoogleAuth({ onUserChange, clientId }: GoogleAuthProps) {
  const activeClientId =
    clientId ||
    (typeof import.meta !== "undefined" && import.meta.env?.["VITE_GOOGLE_CLIENT_ID"]) ||
    DEFAULT_CLIENT_ID;


  const [user, setUser] = useState<GoogleUserProfile | null>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("playpulse_google_user");
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return null;
  });

  const buttonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) {
      onUserChange?.(user);
    }
  }, [user, onUserChange]);

  useEffect(() => {
    if (user) return; // Already logged in

    let intervalId: NodeJS.Timeout;

    const initGsi = () => {
      if (typeof window === "undefined" || !window.google?.accounts?.id || !buttonRef.current) {
        return false;
      }

      try {
        window.google.accounts.id.initialize({
          client_id: activeClientId,
          callback: (response) => {
            const profile = parseJwt(response.credential);
            if (profile) {
              setUser(profile);
              localStorage.setItem("playpulse_google_user", JSON.stringify(profile));
              localStorage.setItem("playpulse_user_email", profile.email);
              onUserChange?.(profile);
            }
          },
        });

        if (buttonRef.current) {
          buttonRef.current.innerHTML = "";
          window.google.accounts.id.renderButton(buttonRef.current, {
            theme: "outline",
            size: "medium",
            type: "standard",
            shape: "pill",
            text: "signin_with",
            logo_alignment: "left",
          });
        }
        return true;
      } catch (err) {
        console.error("[GoogleAuth] Initialization error:", err);
        return false;
      }
    };

    if (!initGsi()) {
      // Script might still be loading async
      intervalId = setInterval(() => {
        if (initGsi()) clearInterval(intervalId);
      }, 300);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [user, activeClientId, onUserChange]);

  const handleSignOut = () => {
    setUser(null);
    localStorage.removeItem("playpulse_google_user");
    localStorage.removeItem("playpulse_user_email");
    onUserChange?.(null);
  };

  if (user) {
    return (
      <div className="flex items-center gap-2 rounded-full border border-glass-border bg-glass/80 px-2 py-1 shadow-sm backdrop-blur-sm">
        {user.picture ? (
          <img
            src={user.picture}
            alt={user.name}
            className="size-6 rounded-full object-cover border border-primary/20"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-primary">
            <UserIcon className="size-3.5" />
          </div>
        )}
        <div className="flex flex-col text-left max-w-[120px] sm:max-w-[180px]">
          <span className="truncate text-xs font-semibold text-foreground leading-tight">
            {user.name}
          </span>
          <span className="truncate text-[10px] text-muted-foreground leading-tight">
            {user.email}
          </span>
        </div>
        <button
          onClick={handleSignOut}
          title="Sign out of Google"
          className="ml-1 rounded-full p-1 text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
        >
          <LogOut className="size-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center">
      <div ref={buttonRef} className="min-h-[32px] overflow-hidden rounded-full" />
    </div>
  );
}
