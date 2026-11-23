import type { ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { EditorModals, EditorProvider } from "@/features/editor";
import { WorkspaceProvider } from "@/features/workspace";
import { queryClient } from "@/lib/queryClient";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={250}>
        <WorkspaceProvider>
          <EditorProvider>
            {children}
            <EditorModals />
          </EditorProvider>
        </WorkspaceProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
