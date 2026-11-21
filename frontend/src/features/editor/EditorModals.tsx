import { lazy, Suspense } from "react";
import { AuthDialog } from "@/components/AuthDialog";
import type { LegalTab } from "@/components/LegalDialog";
import { TurnstileWidget } from "@/components/TurnstileWidget";
import { UploadQueueToast } from "@/components/UploadQueueToast";
import { DocumentsDialog, ShareDialog } from "@/components/WorkspaceDialogs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { useWorkspace } from "@/features/workspace/useWorkspace";
import { startAppwriteOAuth } from "@/lib/auth";
import type { StampSeed } from "./types";
import type { useAssetPlacement } from "./useAssetPlacement";
import type { useDocumentSession } from "./useDocumentSession";
import type { useUploadFlow } from "./useUploadFlow";

const ImageLibraryDialog = lazy(() =>
  import("@/components/ImageLibraryDialog").then((m) => ({
    default: m.ImageLibraryDialog,
  })),
);
const LegalDialog = lazy(() =>
  import("@/components/LegalDialog").then((m) => ({
    default: m.LegalDialog,
  })),
);
const ShortcutsDialog = lazy(() =>
  import("@/components/ShortcutsDialog").then((m) => ({
    default: m.ShortcutsDialog,
  })),
);
const SignaturePadDialog = lazy(() =>
  import("@/components/SignaturePadDialog").then((m) => ({
    default: m.SignaturePadDialog,
  })),
);
const StampStudioDialog = lazy(() =>
  import("@/components/StampStudioDialog").then((m) => ({
    default: m.StampStudioDialog,
  })),
);

export interface AppDialogState {
  authOpen: boolean;
  setAuthOpen: (open: boolean) => void;
  docsOpen: boolean;
  setDocsOpen: (open: boolean) => void;
  shareOpen: boolean;
  setShareOpen: (open: boolean) => void;
  signOpen: boolean;
  setSignOpen: (open: boolean) => void;
  imageOpen: boolean;
  setImageOpen: (open: boolean) => void;
  stampOpen: boolean;
  setStampOpen: (open: boolean) => void;
  stampSeed: StampSeed;
  setStampSeed: (seed: StampSeed) => void;
  shortcutsOpen: boolean;
  setShortcutsOpen: (open: boolean) => void;
  legalTab: LegalTab | null;
  setLegalTab: (tab: LegalTab | null) => void;
}

interface EditorModalsProps {
  workspace: ReturnType<typeof useWorkspace>;
  session: ReturnType<typeof useDocumentSession>;
  upload: ReturnType<typeof useUploadFlow>;
  assetsPlacement: ReturnType<typeof useAssetPlacement>;
  dialogs: AppDialogState;
  onError: (msg: string | null) => void;
}

export function EditorModals({
  workspace,
  session,
  upload,
  assetsPlacement,
  dialogs,
  onError,
}: EditorModalsProps) {
  return (
    <>
      <AuthDialog
        open={dialogs.authOpen}
        onOpenChange={dialogs.setAuthOpen}
        authConfig={workspace.authConfig}
        onOAuthLogin={(provider) => {
          if (!workspace.authConfig) return;
          if (!startAppwriteOAuth(provider, workspace.authConfig)) {
            onError(
              "Social sign-in is currently unavailable. Please try again later.",
            );
          }
        }}
        onDevLogin={workspace.handleDevLogin}
        onOpenLegal={(tab) => {
          dialogs.setAuthOpen(false);
          dialogs.setLegalTab(tab);
        }}
      />

      <Suspense fallback={null}>
        {dialogs.signOpen && (
          <SignaturePadDialog
            open={dialogs.signOpen}
            onOpenChange={dialogs.setSignOpen}
            savedSignatures={workspace.savedSignatures}
            loading={workspace.workspaceLoading}
            onPlaceNewSignature={assetsPlacement.handlePlaceNewSignature}
            onPlaceSavedSignature={assetsPlacement.handlePlaceSavedAsset}
            onDeleteSavedSignature={workspace.handleDeleteAsset}
          />
        )}

        {dialogs.imageOpen && (
          <ImageLibraryDialog
            open={dialogs.imageOpen}
            onOpenChange={dialogs.setImageOpen}
            savedImages={workspace.savedImages}
            loading={workspace.workspaceLoading}
            limits={workspace.uploadLimits}
            onUploadAndPlace={assetsPlacement.handleUploadImageAssetAndPlace}
            onPlaceSavedImage={assetsPlacement.handlePlaceSavedAsset}
            onDeleteSavedImage={workspace.handleDeleteAsset}
            onOpenStampStudio={(opts) => {
              dialogs.setStampSeed({
                file: opts?.file ?? null,
                imageUrl: opts?.asset?.url ?? null,
                name: opts?.asset?.name ?? "",
              });
              dialogs.setStampOpen(true);
            }}
          />
        )}

        {dialogs.stampOpen && (
          <StampStudioDialog
            open={dialogs.stampOpen}
            onOpenChange={dialogs.setStampOpen}
            limits={workspace.uploadLimits}
            initialFile={dialogs.stampSeed.file ?? null}
            initialImageUrl={dialogs.stampSeed.imageUrl ?? null}
            initialName={dialogs.stampSeed.name ?? ""}
            onSaveAndPlaceStamp={assetsPlacement.handlePlaceNewStamp}
          />
        )}

        {dialogs.shortcutsOpen && (
          <ShortcutsDialog
            open={dialogs.shortcutsOpen}
            onOpenChange={dialogs.setShortcutsOpen}
          />
        )}

        {dialogs.legalTab !== null && (
          <LegalDialog
            open={true}
            tab={dialogs.legalTab}
            onTabChange={dialogs.setLegalTab}
            onOpenChange={(open) => {
              if (!open) dialogs.setLegalTab(null);
            }}
          />
        )}
      </Suspense>

      <DocumentsDialog
        open={dialogs.docsOpen}
        onOpenChange={dialogs.setDocsOpen}
        documents={workspace.savedDocs}
        loading={workspace.workspaceLoading}
        activeDocId={session.doc?.doc_id ?? null}
        onOpenDocument={(id) => session.loadSavedDocument(id, null)}
        onDeleteDocument={workspace.handleDeleteSavedDoc}
      />

      {session.doc && (
        <ShareDialog
          open={dialogs.shareOpen}
          onOpenChange={dialogs.setShareOpen}
          docId={session.doc.doc_id}
          filename={session.doc.filename}
          isShared={session.docMeta.isShared}
          shareToken={session.docMeta.shareToken}
          onToggleShare={session.handleToggleShare}
        />
      )}

      <UploadQueueToast
        items={upload.uploadQueue}
        onOpenDocument={(docId) => void session.loadSavedDocument(docId)}
        onDismiss={() => upload.setUploadQueue([])}
      />

      {workspace.captchaRequired && workspace.authConfig?.turnstile_site_key && (
        <Dialog
          open={Boolean(upload.pendingUploadFile)}
          onOpenChange={(open) => {
            if (!open) upload.setPendingUploadFile(null);
          }}
        >
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Verify to upload file</DialogTitle>
              <DialogDescription>
                Complete the verification check to upload{" "}
                <span className="font-medium text-foreground">
                  {upload.pendingUploadFile?.name}
                </span>
                .
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-center py-2">
              <TurnstileWidget
                siteKey={workspace.authConfig.turnstile_site_key}
                resetKey={upload.uploadCaptchaResetKey}
                onToken={(token) => {
                  if (token && upload.pendingUploadFile) {
                    const folderId = upload.uploadTargetFolderRef.current;
                    upload.uploadTargetFolderRef.current = null;
                    void upload.handleUpload(
                      upload.pendingUploadFile,
                      token,
                      folderId,
                    );
                  }
                }}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
