import { useEffect, useState } from "react";
import { LogIn } from "lucide-react";
import { BRAND_NAME, BrandLogo } from "@/components/BrandLogo";
import type { LegalTab } from "@/components/LegalDialog";
import { TurnstileWidget } from "@/components/TurnstileWidget";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import type { AuthConfig } from "@/types";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.87c2.26-2.08 3.56-5.15 3.56-8.65z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.07 7.93-2.91l-3.87-3c-1.07.72-2.45 1.14-4.06 1.14-3.12 0-5.77-2.11-6.72-4.95H1.28v3.1A12 12 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.28A7.2 7.2 0 0 1 4.9 12c0-.79.14-1.56.38-2.28v-3.1H1.28A12 12 0 0 0 0 12c0 1.94.46 3.77 1.28 5.38l4-3.1z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.34.61 4.58 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.28 6.62l4 3.1C6.23 6.88 8.88 4.77 12 4.77z"
      />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.7-3.88-1.54-3.88-1.54-.52-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.68 0-1.25.45-2.28 1.18-3.08-.12-.29-.51-1.46.11-3.04 0 0 .97-.31 3.17 1.18a10.98 10.98 0 0 1 5.78 0c2.2-1.49 3.16-1.18 3.16-1.18.63 1.58.24 2.75.12 3.04.74.8 1.18 1.83 1.18 3.08 0 4.41-2.69 5.38-5.26 5.67.41.36.78 1.07.78 2.15 0 1.55-.01 2.8-.01 3.18 0 .31.21.68.8.56A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z" />
    </svg>
  );
}

interface AuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  authConfig: AuthConfig | null;
  onOAuthLogin: (provider: "google" | "github") => void;
  onDevLogin: (
    email: string,
    name: string,
    captchaToken?: string | null,
  ) => Promise<void>;
  onOpenLegal?: (tab: LegalTab) => void;
}

export function AuthDialog({
  open,
  onOpenChange,
  authConfig,
  onOAuthLogin,
  onDevLogin,
  onOpenLegal,
}: AuthDialogProps) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaResetKey, setCaptchaResetKey] = useState(0);

  const oauthReady = authConfig?.mode === "appwrite";
  // Test/local sign-in is strictly restricted to local development builds + backend flag.
  const showDevLogin =
    import.meta.env.DEV && Boolean(authConfig?.dev_login_enabled);
  const captchaRequired = Boolean(
    authConfig?.captcha_enabled && authConfig.turnstile_site_key,
  );

  useEffect(() => {
    if (!open) {
      setLocalError(null);
      setCaptchaToken(null);
    }
  }, [open]);

  const submitDev = async (targetEmail: string, targetName: string) => {
    if (!targetEmail.trim()) return;
    if (captchaRequired && !captchaToken) {
      setLocalError("Please complete the verification check first.");
      return;
    }
    setSubmitting(true);
    setLocalError(null);
    try {
      await onDevLogin(targetEmail.trim(), targetName.trim(), captchaToken);
      onOpenChange(false);
    } catch (err: unknown) {
      setLocalError(err instanceof Error ? err.message : "Sign-in failed.");
      if (captchaRequired) {
        setCaptchaToken(null);
        setCaptchaResetKey((k) => k + 1);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader className="items-center text-center sm:text-center">
          <div className="mb-1 flex items-center justify-center">
            <BrandLogo size={32} />
          </div>
          <DialogTitle className="text-lg">
            Sign in to {BRAND_NAME}
          </DialogTitle>
          <DialogDescription>
            Sync your documents, folders, signatures, and stamps across devices
            and collaborate via share links.
          </DialogDescription>
        </DialogHeader>

        {/* Primary Social Sign-in */}
        <div className="mt-1 space-y-2.5">
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="h-10 w-full justify-center gap-2.5 border-[#2a2b2f] bg-[#141516] text-[13px] font-medium text-[#f7f8f8] hover:bg-[#1c1d1f]"
            disabled={!oauthReady}
            onClick={() => onOAuthLogin("google")}
          >
            <GoogleIcon />
            Continue with Google
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="h-10 w-full justify-center gap-2.5 border-[#2a2b2f] bg-[#141516] text-[13px] font-medium text-[#f7f8f8] hover:bg-[#1c1d1f]"
            disabled={!oauthReady}
            onClick={() => onOAuthLogin("github")}
          >
            <GitHubIcon />
            Continue with GitHub
          </Button>
          {!oauthReady && !showDevLogin && (
            <p className="rounded-lg border border-border bg-secondary/70 px-3 py-2 text-center text-xs text-muted-foreground">
              Sign-in is temporarily unavailable. Please try again shortly.
            </p>
          )}
        </div>

        {/* Local development test sign-in (never compiled into production builds) */}
        {showDevLogin && (
          <>
            <div className="relative flex items-center py-1">
              <Separator className="flex-1" />
              <span className="px-2.5 text-[10px] tracking-wider text-muted-foreground uppercase">
                Dev test accounts
              </span>
              <Separator className="flex-1" />
            </div>

            {captchaRequired && authConfig?.turnstile_site_key && (
              <div className="flex flex-col items-center gap-1 py-1">
                <TurnstileWidget
                  siteKey={authConfig.turnstile_site_key}
                  resetKey={captchaResetKey}
                  onToken={setCaptchaToken}
                />
                {!captchaToken && (
                  <p className="text-[11px] text-muted-foreground">
                    Complete verification to continue
                  </p>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="secondary"
                size="default"
                disabled={submitting || (captchaRequired && !captchaToken)}
                onClick={() => void submitDev("alice@local.dev", "Alice")}
              >
                Sign in as Alice
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="default"
                disabled={submitting || (captchaRequired && !captchaToken)}
                onClick={() => void submitDev("bob@local.dev", "Bob")}
              >
                Sign in as Bob
              </Button>
            </div>

            <form
              className="space-y-2 pt-1"
              onSubmit={(e) => {
                e.preventDefault();
                void submitDev(email, name);
              }}
            >
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="email"
                  required
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-8 text-xs"
                />
                <Input
                  type="text"
                  placeholder="Display name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              {localError && (
                <p className="text-xs text-destructive">{localError}</p>
              )}
              <Button
                type="submit"
                className="w-full"
                disabled={
                  submitting ||
                  !email.trim() ||
                  (captchaRequired && !captchaToken)
                }
              >
                <LogIn className="h-3.5 w-3.5" />
                {submitting ? "Signing in..." : "Sign in locally"}
              </Button>
            </form>
          </>
        )}

        <p className="pt-1 text-center text-[11px] leading-relaxed text-muted-foreground">
          By continuing, you agree to our{" "}
          <button
            type="button"
            onClick={() => onOpenLegal?.("terms")}
            className="cursor-pointer text-foreground/80 underline-offset-2 hover:text-foreground hover:underline"
          >
            Terms
          </button>{" "}
          and{" "}
          <button
            type="button"
            onClick={() => onOpenLegal?.("privacy")}
            className="cursor-pointer text-foreground/80 underline-offset-2 hover:text-foreground hover:underline"
          >
            Privacy Policy
          </button>
          .
        </p>
      </DialogContent>
    </Dialog>
  );
}
