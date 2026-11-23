import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";
import { AppProviders } from "@/app/AppProviders";
import { LandingPage } from "@/components/LandingPage";
import { useEditor } from "@/features/editor/context/EditorContext";
import { EditorWorkspace } from "@/features/editor/components/EditorWorkspace";
import { isProtectedUrl } from "@/features/workspace/utils/authGuard";
import { useWorkspace } from "@/features/workspace/context/WorkspaceContext";

const DashboardPage = lazy(() =>
  import("@/components/DashboardPage").then((m) => ({
    default: m.DashboardPage,
  })),
);

function RouteLoader({ label }: { label: string }) {
  return (
    <div className="flex h-dvh w-full items-center justify-center bg-shell text-xs text-muted-foreground">
      <Loader2 className="mr-2 h-4 w-4 animate-spin text-brand" />
      {label}
    </div>
  );
}

function AppViews() {
  const { view, isSignedIn, authLoading } = useWorkspace();
  const { session } = useEditor();

  const wantsProtected =
    view === "dashboard" ||
    Boolean(session.doc) ||
    session.docLoading ||
    isProtectedUrl();

  if (authLoading && wantsProtected) {
    return <RouteLoader label="Checking your session..." />;
  }

  if (!isSignedIn) {
    return <LandingPage />;
  }

  if (session.doc || session.docLoading) {
    return <EditorWorkspace />;
  }

  if (view === "dashboard") {
    return (
      <Suspense fallback={<RouteLoader label="Loading workspace..." />}>
        <DashboardPage />
      </Suspense>
    );
  }

  return <LandingPage />;
}

export function App() {
  return (
    <AppProviders>
      <AppViews />
    </AppProviders>
  );
}
