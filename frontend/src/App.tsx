import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";
import { AppProviders } from "@/app/AppProviders";
import { LandingPage } from "@/components/LandingPage";
import { useEditor } from "@/features/editor/EditorContext";
import { EditorWorkspace } from "@/features/editor/EditorWorkspace";
import { useWorkspace } from "@/features/workspace/WorkspaceContext";

const DashboardPage = lazy(() =>
  import("@/components/DashboardPage").then((m) => ({
    default: m.DashboardPage,
  })),
);

function AppViews() {
  const { view } = useWorkspace();
  const { session } = useEditor();

  if (session.doc || session.docLoading) {
    return <EditorWorkspace />;
  }

  if (view === "dashboard") {
    return (
      <Suspense
        fallback={
          <div className="flex h-dvh w-full items-center justify-center bg-[#0a0a0b] text-xs text-[#8a8f98]">
            <Loader2 className="mr-2 h-4 w-4 animate-spin text-[#7170ff]" />
            Loading workspace...
          </div>
        }
      >
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
