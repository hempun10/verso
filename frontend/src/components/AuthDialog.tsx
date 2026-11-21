import { useState } from "react";
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
import { GitHubIcon, GoogleIcon } from "@/components/ui/social-icons";
import type { AuthConfig } from "@/types";

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

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setLocalError(null);
      setCaptchaToken(null);
    }
    onOpenChange(nextOpen);
  };

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
      handleOpenChange(false);
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
    <Dialog open={open} onOpenChange={handleOpenChange}>
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
