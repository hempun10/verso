import type { LegalTab } from "@/components/LegalDialog";
import { AlertBanner } from "@/components/ui/alert-banner";
import { LandingFooter } from "@/features/landing/LandingFooter";
import { LandingHeader } from "@/features/landing/LandingHeader";
import { LandingHero } from "@/features/landing/LandingHero";
import { LandingSections } from "@/features/landing/LandingSections";
import { PageFrame } from "@/features/landing/primitives";
import type { UploadLimits, UserInfo } from "@/types";

interface LandingPageProps {
  uploadLimits: UploadLimits;
  captchaRequired: boolean;
  turnstileSiteKey: string;
  uploadCaptchaToken: string | null;
  uploadCaptchaResetKey: number;
  onCaptchaToken: (token: string | null) => void;
  onChooseFile: () => void;
  onUploadFiles: (files: File[]) => void;
  authLoading: boolean;
  isSignedIn: boolean;
  user: UserInfo | null;
  onOpenAuth: () => void;
  onOpenDashboard: () => void;
  onSignOut: () => void;
  onOpenShortcuts: () => void;
  onOpenLegal: (tab: LegalTab) => void;
  error: string | null;
  onDismissError: () => void;
}

export function LandingPage({
  uploadLimits,
  captchaRequired,
  turnstileSiteKey,
  uploadCaptchaToken,
  uploadCaptchaResetKey,
  onCaptchaToken,
  onChooseFile,
  onUploadFiles,
  authLoading,
  isSignedIn,
  user,
  onOpenAuth,
  onOpenDashboard,
  onSignOut,
  onOpenShortcuts,
  onOpenLegal,
  error,
  onDismissError,
}: LandingPageProps) {
  return (
    <div className="landing-shell isolate min-h-svh w-full bg-[#08090a] text-[#f7f8f8] antialiased">
      <PageFrame>
        <LandingHeader
          authLoading={authLoading}
          isSignedIn={isSignedIn}
          user={user}
          onOpenAuth={onOpenAuth}
          onOpenDashboard={onOpenDashboard}
          onSignOut={onSignOut}
        />

        {error && (
          <div className="relative z-30 mx-auto max-w-3xl px-6 pt-4">
            <AlertBanner message={error} onDismiss={onDismissError} />
          </div>
        )}

        <main className="flex w-full flex-col items-center justify-center divide-y divide-[#1f2023]">
          <LandingHero
            uploadLimits={uploadLimits}
            captchaRequired={captchaRequired}
            turnstileSiteKey={turnstileSiteKey}
            uploadCaptchaToken={uploadCaptchaToken}
            uploadCaptchaResetKey={uploadCaptchaResetKey}
            onCaptchaToken={onCaptchaToken}
            onChooseFile={onChooseFile}
            onUploadFiles={onUploadFiles}
            onOpenDashboard={onOpenDashboard}
          />

          <LandingSections
            uploadLimits={uploadLimits}
            uploadDisabled={captchaRequired && !uploadCaptchaToken}
            onChooseFile={onChooseFile}
          />

          <LandingFooter
            isSignedIn={isSignedIn}
            user={user}
            onOpenAuth={onOpenAuth}
            onOpenDashboard={onOpenDashboard}
            onChooseFile={onChooseFile}
            onSignOut={onSignOut}
            onOpenShortcuts={onOpenShortcuts}
            onOpenLegal={onOpenLegal}
          />
        </main>
      </PageFrame>
    </div>
  );
}
