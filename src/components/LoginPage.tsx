import { useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Bot,
  CheckCircle2,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import { type GoogleUserProfile } from "./GoogleAuth";

interface LoginPageProps {
  onLoginSuccess: (user: GoogleUserProfile) => void;
  clientId?: string;
}

const DEFAULT_CLIENT_ID =
  "775526888744-a6jrerd46hi3848agjiqn9uo768nj9nj.apps.googleusercontent.com";

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
  } catch {
    return null;
  }
}

export function LoginPage({ onLoginSuccess, clientId }: LoginPageProps) {
  const activeClientId =
    clientId ||
    (typeof import.meta !== "undefined" && import.meta.env?.["VITE_GOOGLE_CLIENT_ID"]) ||
    DEFAULT_CLIENT_ID;

  const [emailInput, setEmailInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [showEmailForm, setShowEmailForm] = useState(false);
  const googleBtnRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    const initGsi = () => {
      if (typeof window === "undefined" || !window.google?.accounts?.id || !googleBtnRef.current) {
        return false;
      }

      try {
        window.google.accounts.id.initialize({
          client_id: activeClientId,
          callback: (response) => {
            const profile = parseJwt(response.credential);
            if (profile) {
              localStorage.setItem("playpulse_google_user", JSON.stringify(profile));
              localStorage.setItem("playpulse_user_email", profile.email);
              onLoginSuccess(profile);
            }
          },
        });

        if (googleBtnRef.current) {
          googleBtnRef.current.innerHTML = "";
          window.google.accounts.id.renderButton(googleBtnRef.current, {
            theme: "outline",
            size: "large",
            type: "standard",
            shape: "pill",
            text: "signin_with",
            logo_alignment: "left",
            width: 280,
          });
        }
        return true;
      } catch (err) {
        console.error("[LoginPage] GSI Init error:", err);
        return false;
      }
    };

    if (!initGsi()) {
      intervalId = setInterval(() => {
        if (initGsi()) clearInterval(intervalId);
      }, 300);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [activeClientId, onLoginSuccess]);

  const handleManualEmailLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = emailInput.trim();
    if (!cleanEmail || !cleanEmail.includes("@")) return;

    const profile: GoogleUserProfile = {
      email: cleanEmail,
      name: nameInput.trim() || cleanEmail.split("@")[0] || "Researcher",
      sub: `manual_${Date.now()}`,
    };

    localStorage.setItem("playpulse_google_user", JSON.stringify(profile));
    localStorage.setItem("playpulse_user_email", profile.email);
    onLoginSuccess(profile);
  };

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden px-4 py-12">
      {/* Background ambient lighting effects */}
      <div className="pointer-events-none absolute -top-40 -left-40 size-96 rounded-full bg-primary/20 blur-[128px]" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 size-96 rounded-full bg-indigo-500/20 blur-[128px]" />

      <div className="relative z-10 w-full max-w-md">
        {/* PlayPulse Hero Branding */}
        <div className="mb-8 text-center">
          <div className="inline-flex size-14 items-center justify-center rounded-2xl border border-glass-border bg-glass shadow-2xl backdrop-blur-xl mb-4">
            <Sparkles className="size-7 text-primary animate-pulse" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            <span className="text-gradient">PlayPulse</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            AI-powered user research on Google Play reviews
          </p>
        </div>

        {/* Login Container Card */}
        <div className="glass-panel relative overflow-hidden p-6 sm:p-8">
          <div className="mb-6 text-center">
            <h2 className="text-lg font-semibold text-foreground">Sign In to Continue</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Authenticate to track sessions, analyze reviews, and stream live metrics to Power BI
            </p>
          </div>

          {/* Google Sign In Area */}
          <div className="flex flex-col items-center justify-center gap-4">
            <div
              ref={googleBtnRef}
              className="flex min-h-[44px] w-full justify-center overflow-hidden rounded-full transition-transform hover:scale-[1.02]"
            />

            {/* Divider */}
            <div className="relative my-2 w-full text-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-glass-border" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-card px-3 text-muted-foreground">or email access</span>
              </div>
            </div>

            {/* Alternate Email Access Toggle */}
            {!showEmailForm ? (
              <button
                type="button"
                onClick={() => setShowEmailForm(true)}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-glass-border bg-white/5 py-2.5 text-xs font-medium text-foreground transition-colors hover:bg-white/10"
              >
                <Mail className="size-3.5 text-muted-foreground" />
                <span>Continue with Email</span>
              </button>
            ) : (
              <form onSubmit={handleManualEmailLogin} className="w-full space-y-3">
                <div>
                  <label htmlFor="userEmail" className="mb-1 block text-xs font-medium text-muted-foreground">
                    Work Email
                  </label>
                  <input
                    id="userEmail"
                    type="email"
                    required
                    placeholder="you@company.com"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    className="w-full rounded-xl border border-glass-border bg-glass px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/50"
                  />
                </div>
                <div>
                  <label htmlFor="userName" className="mb-1 block text-xs font-medium text-muted-foreground">
                    Researcher Name (Optional)
                  </label>
                  <input
                    id="userName"
                    type="text"
                    placeholder="Your Name"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    className="w-full rounded-xl border border-glass-border bg-glass px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/50"
                  />
                </div>
                <button
                  type="submit"
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-xs font-semibold text-primary-foreground shadow-lg transition-transform hover:scale-[1.01] active:scale-[0.99]"
                >
                  <span>Enter PlayPulse</span>
                  <ArrowRight className="size-3.5" />
                </button>
              </form>
            )}
          </div>

          {/* Features Checklist */}
          <div className="mt-8 border-t border-glass-border pt-5">
            <div className="space-y-2 text-left">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CheckCircle2 className="size-3.5 text-emerald-400 shrink-0" />
                <span>Scrapes & synthesizes thousands of real Play Store reviews</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CheckCircle2 className="size-3.5 text-emerald-400 shrink-0" />
                <span>Gemini 3.6 Flash user-research dialogue</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CheckCircle2 className="size-3.5 text-emerald-400 shrink-0" />
                <span>Live Power BI telemetry (tokens, duration, friction errors)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Live Power BI Status pill at footer */}
        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="size-4 text-emerald-400" />
          <span>Encrypted Telemetry & Live Power BI Connector Ready</span>
        </div>
      </div>
    </div>
  );
}
