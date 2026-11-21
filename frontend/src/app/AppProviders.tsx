import type { ReactNode } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { EditorModals } from "@/features/editor/EditorModals";
import { EditorProvider } from "@/features/editor/EditorContext";
import { WorkspaceProvider } from "@/features/workspace/WorkspaceContext";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <TooltipProvider delayDuration={250}>
      <WorkspaceProvider>
        <EditorProvider>
          {children}
          <EditorModals />
        </EditorProvider>
      </WorkspaceProvider>
    </TooltipProvider>
  );
}
