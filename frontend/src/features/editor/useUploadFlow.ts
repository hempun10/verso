import { useRef, useState } from "react";
import { uploadDocument } from "@/api";
import type { UploadQueueItem } from "@/components/UploadQueueToast";
import {
  isImageFilename,
  MAX_BATCH_UPLOAD_FILES,
  validateDocumentFileClient,
} from "@/lib/validation";
import type { DocumentSummary, UploadLimits } from "@/types";
import { updateUrlParams } from "./types";

interface UseUploadFlowArgs {
  isSignedIn: boolean;
  onRequireAuth: () => void;
  uploadLimits: UploadLimits;
  captchaRequired: boolean;
  hasActiveDoc: boolean;
  view: "landing" | "dashboard";
  onSetView: (view: "landing" | "dashboard") => void;
  onError: (msg: string | null) => void;
  onStartSingleUpload: (busyLabel: string) => void;
  onFinishSingleUpload: () => void;
  onSingleUploadSuccess: (summary: DocumentSummary) => void;
  onRefreshWorkspace: () => Promise<void>;
}

export function useUploadFlow({
  isSignedIn,
  onRequireAuth,
  uploadLimits,
  captchaRequired,
  hasActiveDoc,
  view,
  onSetView,
  onError,
  onStartSingleUpload,
  onFinishSingleUpload,
  onSingleUploadSuccess,
  onRefreshWorkspace,
}: UseUploadFlowArgs) {
  const [uploadCaptchaToken, setUploadCaptchaToken] = useState<string | null>(
    null,
  );
  const [uploadCaptchaResetKey, setUploadCaptchaResetKey] = useState(0);
  const [pendingUploadFile, setPendingUploadFile] = useState<File | null>(null);
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);
  const uploadTargetFolderRef = useRef<string | null>(null);

  const handleUpload = async (
    file: File,
    explicitCaptchaToken?: string | null,
    folderId?: string | null,
  ) => {
    if (!isSignedIn) {
      onRequireAuth();
      return;
    }
    onError(null);
    const validationError = await validateDocumentFileClient(
      file,
      uploadLimits,
    );
    if (validationError) {
      onError(validationError);
      return;
    }

    const token = explicitCaptchaToken ?? uploadCaptchaToken;
    if (captchaRequired && !token) {
      if (hasActiveDoc || view === "dashboard") {
        uploadTargetFolderRef.current = folderId ?? null;
        setPendingUploadFile(file);
      } else {
        onError(
          "Please complete the human verification check below before uploading.",
        );
      }
      return;
    }

    setPendingUploadFile(null);
    onStartSingleUpload(
      isImageFilename(file.name)
        ? "Uploading and analyzing image..."
        : "Uploading and analyzing PDF...",
    );
    try {
      const summary = await uploadDocument(file, token, folderId);
      onSingleUploadSuccess(summary);
      void onRefreshWorkspace();
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      onFinishSingleUpload();
      if (captchaRequired) {
        setUploadCaptchaToken(null);
        setUploadCaptchaResetKey((k) => k + 1);
      }
    }
  };

  const handleUploadFiles = async (
    files: File[],
    folderId?: string | null,
  ) => {
    if (files.length === 0) return;
    if (!isSignedIn) {
      onRequireAuth();
      return;
    }
    if (files.length === 1) {
      await handleUpload(files[0]!, undefined, folderId);
      return;
    }

    onError(null);
    if (captchaRequired) {
      onError(
        "Security verification is active — please upload one file at a time.",
      );
      return;
    }
    if (files.length > MAX_BATCH_UPLOAD_FILES) {
      onError(
        `You can upload up to ${MAX_BATCH_UPLOAD_FILES} files at a time (you selected ${files.length}).`,
      );
      return;
    }

    if (!hasActiveDoc && view !== "dashboard") {
      onSetView("dashboard");
      updateUrlParams(null, null, "dashboard");
      void onRefreshWorkspace();
    }

    const batchId = Date.now().toString(36);
    const entries = files.map((file, idx) => ({
      id: `up_${batchId}_${idx}`,
      file,
    }));

    const validated = await Promise.all(
      entries.map(async (entry) => ({
        ...entry,
        validationError: await validateDocumentFileClient(
          entry.file,
          uploadLimits,
        ),
      })),
    );

    const initialQueue: UploadQueueItem[] = validated.map((v) => ({
      id: v.id,
      filename: v.file.name,
      status: v.validationError ? "error" : "queued",
      error: v.validationError ?? undefined,
    }));
    setUploadQueue((prev) => [...initialQueue, ...prev.slice(0, 12)]);

    const validWork = validated.filter((v) => !v.validationError);
    if (validWork.length === 0) return;

    const CONCURRENCY = 2;
    let cursor = 0;
    const runWorker = async () => {
      while (cursor < validWork.length) {
        const current = validWork[cursor++]!;
        setUploadQueue((prev) =>
          prev.map((item) =>
            item.id === current.id ? { ...item, status: "uploading" } : item,
          ),
        );
        try {
          const summary = await uploadDocument(current.file, null, folderId);
          setUploadQueue((prev) =>
            prev.map((item) =>
              item.id === current.id
                ? { ...item, status: "done", docId: summary.doc_id }
                : item,
            ),
          );
          void onRefreshWorkspace();
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Upload failed.";
          setUploadQueue((prev) =>
            prev.map((item) =>
              item.id === current.id
                ? { ...item, status: "error", error: msg }
                : item,
            ),
          );
        }
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, validWork.length) }, () =>
        runWorker(),
      ),
    );
  };

  return {
    uploadCaptchaToken,
    setUploadCaptchaToken,
    uploadCaptchaResetKey,
    pendingUploadFile,
    setPendingUploadFile,
    uploadQueue,
    setUploadQueue,
    uploadTargetFolderRef,
    handleUpload,
    handleUploadFiles,
  };
}
