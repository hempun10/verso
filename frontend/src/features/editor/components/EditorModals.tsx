import { lazy, Suspense } from "react";
import { AuthDialog } from "@/components/AuthDialog";
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
import { useWorkspace } from "@/features/workspace/context/WorkspaceContext";
import { useEditor } from "../context/EditorContext";

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

export function EditorModals() {
  const workspace = useWorkspace();
  const {
    docsOpen,
    setDocsOpen,
    shareOpen,
    setShareOpen,
    signOpen,
    setSignOpen,
    imageOpen,
    setImageOpen,
    stampOpen,
    setStampOpen,
    stampSeed,
    openStampStudio,
    session,
    upload,
    assetsPlacement,
    deleteDocument,
  } = useEditor();

  return (
    <>
      <AuthDialog
        open={workspace.authOpen}
        onOpenChange={workspace.setAuthOpen}
        authConfig={workspace.authConfig}
        onOAuthLogin={workspace.handleOAuthLogin}
        onDevLogin={workspace.handleDevLogin}
        onOpenLegal={(tab) => {
          workspace.setAuthOpen(false);
          workspace.setLegalTab(tab);
        }}
      />

      <Suspense fallback={null}>
        {signOpen && (
          <SignaturePadDialog
            open={signOpen}
            onOpenChange={setSignOpen}
            savedSignatures={workspace.savedSignatures}
            loading={workspace.workspaceLoading}
            onPlaceNewSignature={assetsPlacement.handlePlaceNewSignature}
            onPlaceSavedSignature={assetsPlacement.handlePlaceSavedAsset}
            onDeleteSavedSignature={workspace.handleDeleteAsset}
          />
        )}

        {imageOpen && (
          <ImageLibraryDialog
            open={imageOpen}
            onOpenChange={setImageOpen}
            savedImages={workspace.savedImages}
            loading={workspace.workspaceLoading}
            limits={workspace.uploadLimits}
            onUploadAndPlace={assetsPlacement.handleUploadImageAssetAndPlace}
            onPlaceSavedImage={assetsPlacement.handlePlaceSavedAsset}
            onDeleteSavedImage={workspace.handleDeleteAsset}
            onOpenStampStudio={openStampStudio}
          />
        )}

        {stampOpen && (
          <StampStudioDialog
            open={stampOpen}
            onOpenChange={setStampOpen}
            limits={workspace.uploadLimits}
            initialFile={stampSeed.file ?? null}
            initialImageUrl={stampSeed.imageUrl ?? null}
            initialName={stampSeed.name ?? ""}
            onSaveAndPlaceStamp={assetsPlacement.handlePlaceNewStamp}
          />
        )}

        {workspace.shortcutsOpen && (
          <ShortcutsDialog
            open={workspace.shortcutsOpen}
            onOpenChange={workspace.setShortcutsOpen}
          />
        )}

        {workspace.legalTab !== null && (
          <LegalDialog
            open={true}
            tab={workspace.legalTab}
            onTabChange={workspace.setLegalTab}
            onOpenChange={(open) => {
              if (!open) workspace.setLegalTab(null);
            }}
          />
        )}
      </Suspense>

      <DocumentsDialog
        open={docsOpen}
        onOpenChange={setDocsOpen}
        documents={workspace.savedDocs}
        loading={workspace.workspaceLoading}
        activeDocId={session.doc?.doc_id ?? null}
        onOpenDocument={(id) => session.loadSavedDocument(id, null)}
        onDeleteDocument={deleteDocument}
      />

      {session.doc && (
        <ShareDialog
          open={shareOpen}
          onOpenChange={setShareOpen}
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
