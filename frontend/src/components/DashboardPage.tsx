import { AlertBanner } from "@/components/ui/alert-banner";
import { FileDropOverlay } from "@/components/ui/file-drop-overlay";
import { DashboardCanvas } from "@/features/dashboard/DashboardCanvas";
import {
  DashboardProvider,
  useDashboard,
} from "@/features/dashboard/DashboardContext";
import { DashboardContextMenu } from "@/features/dashboard/DashboardContextMenu";
import { DashboardHeader } from "@/features/dashboard/DashboardHeader";
import { DashboardModals } from "@/features/dashboard/DashboardModals";
import { DashboardSidebar } from "@/features/dashboard/DashboardSidebar";
import { useWorkspace } from "@/features/workspace/WorkspaceContext";
import { formatFileSize, MAX_BATCH_UPLOAD_FILES } from "@/lib/validation";

function DashboardShell() {
  const { error, clearError, uploadLimits } = useWorkspace();
  const {
    mobileNavOpen,
    setMobileNavOpen,
    pageDragging,
    uploadTargetLabel,
    contextMenu,
  } = useDashboard();

  return (
    <div className="landing-shell flex h-dvh w-full overflow-hidden bg-[#0a0a0b] text-[#f7f8f8] antialiased">
      <aside className="hidden h-full w-[248px] shrink-0 md:block">
        <DashboardSidebar />
      </aside>

      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-xs"
            onClick={() => setMobileNavOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-[264px] border-r border-[#1f2023] bg-[#0a0a0b] shadow-2xl">
            <DashboardSidebar />
          </aside>
        </div>
      )}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col p-2 md:py-2.5 md:pr-2.5 md:pl-0">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[#1f2023] bg-[#0f1011]">
          <DashboardHeader />

          {error && (
            <AlertBanner
              message={error}
              onDismiss={clearError}
              className="rounded-none border-x-0 border-t-0 px-5"
            />
          )}

          <DashboardCanvas />
        </div>
      </div>

      <FileDropOverlay
        visible={pageDragging}
        title={`Drop PDFs or images to upload into ${uploadTargetLabel}`}
        subtitle={`Up to ${MAX_BATCH_UPLOAD_FILES} files at once · PDF up to ${formatFileSize(uploadLimits.max_pdf_bytes)} · Images up to ${formatFileSize(uploadLimits.max_image_bytes)}`}
      />

      {contextMenu && <DashboardContextMenu />}
      <DashboardModals />
    </div>
  );
}

export function DashboardPage() {
  return (
    <DashboardProvider>
      <DashboardShell />
    </DashboardProvider>
  );
}
