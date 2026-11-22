import type { ReactNode } from "react";
import { ServerWakeBanner } from "@/components/ServerWakeBanner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { EditorProvider } from "@/features/editor/EditorContext";
import { EditorModals } from "@/features/editor/EditorModals";
import { WorkspaceProvider } from "@/features/workspace/WorkspaceContext";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <TooltipProvider delayDuration={250}>
      <WorkspaceProvider>
        <EditorProvider>
          {children}
          <EditorModals />
          <ServerWakeBanner />
        </EditorProvider>
      </WorkspaceProvider>
    </TooltipProvider>
  );
}
