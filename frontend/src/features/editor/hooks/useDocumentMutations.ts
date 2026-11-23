import { useMutation } from "@tanstack/react-query";
import {
  exportEditedImage,
  exportEditedPdf,
  saveDocumentState,
  setDocumentShare,
} from "@/api";
import type { PageOverlay, TextEdit } from "@/types";

export function useDocumentMutations() {
  const saveStateMut = useMutation({
    mutationFn: (vars: {
      docId: string;
      edits: TextEdit[];
      overlays: PageOverlay[];
      shareToken: string | null;
    }) =>
      saveDocumentState(vars.docId, vars.edits, vars.overlays, vars.shareToken),
  });

  const shareMut = useMutation({
    mutationFn: ({ docId, shared }: { docId: string; shared: boolean }) =>
      setDocumentShare(docId, shared),
  });

  const exportMut = useMutation({
    mutationFn: (vars: {
      format: "pdf" | "png";
      docId: string;
      pageIndex: number;
      allEdits: TextEdit[];
      pageEdits: TextEdit[];
      allOverlays: PageOverlay[];
      pageOverlays: PageOverlay[];
      shareToken: string | null;
    }) =>
      vars.format === "png"
        ? exportEditedImage(
            vars.docId,
            vars.pageIndex,
            vars.pageEdits,
            vars.pageOverlays,
            200,
            vars.shareToken,
          )
        : exportEditedPdf(
            vars.docId,
            vars.allEdits,
            vars.allOverlays,
            vars.shareToken,
          ),
  });

  return { saveStateMut, shareMut, exportMut };
}
