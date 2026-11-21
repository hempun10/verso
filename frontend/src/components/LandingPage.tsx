import { AlertBanner } from "@/components/ui/alert-banner";
import { LandingFooter } from "@/features/landing/LandingFooter";
import { LandingHeader } from "@/features/landing/LandingHeader";
import { LandingHero } from "@/features/landing/LandingHero";
import { LandingSections } from "@/features/landing/LandingSections";
import { PageFrame } from "@/features/landing/primitives";
import { useWorkspace } from "@/features/workspace/WorkspaceContext";

export function LandingPage() {
  const { error, clearError } = useWorkspace();

  return (
    <div className="landing-shell isolate min-h-svh w-full bg-[#08090a] text-[#f7f8f8] antialiased">
      <PageFrame>
        <LandingHeader />

        {error && (
          <div className="relative z-30 mx-auto max-w-3xl px-6 pt-4">
            <AlertBanner message={error} onDismiss={clearError} />
          </div>
        )}

        <main className="flex w-full flex-col items-center justify-center divide-y divide-[#1f2023]">
          <LandingHero />
          <LandingSections />
          <LandingFooter />
        </main>
      </PageFrame>
    </div>
  );
}
