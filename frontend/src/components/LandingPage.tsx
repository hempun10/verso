import { AlertBanner } from "@/components/ui/alert-banner";
import { LandingFooter } from "@/features/landing/components/LandingFooter";
import { LandingHeader } from "@/features/landing/components/LandingHeader";
import { LandingHero } from "@/features/landing/components/LandingHero";
import { LandingSections } from "@/features/landing/components/LandingSections";
import { PageFrame } from "@/features/landing/components/primitives";
import { useWorkspace } from "@/features/workspace/context/WorkspaceContext";

export function LandingPage() {
  const { error, clearError } = useWorkspace();

  return (
    <div className="landing-shell isolate min-h-svh w-full bg-background text-foreground antialiased">
      <PageFrame>
        <LandingHeader />

        {error && (
          <div className="relative z-30 mx-auto max-w-3xl px-6 pt-4">
            <AlertBanner message={error} onDismiss={clearError} />
          </div>
        )}

        <main className="flex w-full flex-col items-center justify-center divide-y divide-border">
          <LandingHero />
          <LandingSections />
          <LandingFooter />
        </main>
      </PageFrame>
    </div>
  );
}
