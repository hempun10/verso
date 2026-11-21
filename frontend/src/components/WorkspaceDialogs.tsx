import { useState } from "react";
import {
  Check,
  Copy,
  FileText,
  FolderOpen,
  Image as ImageIcon,
  Link2,
  Loader2,
  Trash2,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { isImageFilename } from "@/lib/validation";
import type { DocumentListItem } from "@/types";

function formatRelativeTime(epochSeconds: number): string {
  if (!epochSeconds) return "";
  const diff = Math.max(0, Math.floor(Date.now() / 1000 - epochSeconds));
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(epochSeconds * 1000).toLocaleDateString();
}

interface DocumentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documents: DocumentListItem[];
  loading?: boolean;
  activeDocId: string | null;
  onOpenDocument: (docId: string) => Promise<void>;
  onDeleteDocument: (docId: string) => Promise<void>;
}

export function DocumentsDialog({
  open,
  onOpenChange,
  documents,
  loading = false,
  activeDocId,
  onOpenDocument,
  onDeleteDocument,
}: DocumentsDialogProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (docId: string) => {
    setDeletingId(docId);
    try {
      await onDeleteDocument(docId);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="h-4 w-4" />
            Saved Documents
          </DialogTitle>
          <DialogDescription>
            Resume any saved editing session with all text edits, whiteouts,
            signatures, and images intact.
          </DialogDescription>
        </DialogHeader>

        {loading && documents.length === 0 ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-xl border border-border bg-secondary p-3"
              >
                <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-44" />
                  <Skeleton className="h-2.5 w-32" />
                </div>
              </div>
            ))}
          </div>
        ) : documents.length === 0 ? (
          <div className="flex h-36 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-input bg-secondary/60 text-center">
            <p className="text-xs font-medium text-foreground">
              No saved documents yet
            </p>
            <p className="text-[11px] text-muted-foreground">
              Upload a PDF or image to start a saved session in your workspace.
            </p>
          </div>
        ) : (
          <div className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
            {documents.map((item) => {
              const isActive = item.doc_id === activeDocId;
              const changeCount = item.edit_count + item.overlay_count;
              const isDeleting = deletingId === item.doc_id;
              return (
                <div
                  key={item.doc_id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-secondary p-3 transition-colors hover:border-input hover:bg-accent/70"
                >
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left"
                    onClick={() => {
                      void onOpenDocument(item.doc_id);
                      onOpenChange(false);
                    }}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground">
                      {isImageFilename(item.filename) ? (
                        <ImageIcon className="h-4 w-4 text-[#7170ff]" />
                      ) : (
                        <FileText className="h-4 w-4" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-xs font-semibold text-foreground">
                          {item.filename}
                        </span>
                        {isActive && (
                          <Badge variant="default" className="px-1.5 py-0 text-[10px]">
                            Open
                          </Badge>
                        )}
                        {item.is_shared && (
                          <Badge variant="native" className="gap-0.5 px-1.5 py-0 text-[10px]">
                            <Users className="h-2.5 w-2.5" />
                            Shared
                          </Badge>
                        )}
                      </div>
                      <div className="mt-0.5 text-[11px] text-muted-foreground">
                        {item.page_count} page{item.page_count === 1 ? "" : "s"}{" "}
                        · {changeCount} change{changeCount === 1 ? "" : "s"} ·{" "}
                        {formatRelativeTime(item.updated_at)}
                        {item.updated_by ? ` by ${item.updated_by}` : ""}
                      </div>
                    </div>
                  </button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={isDeleting}
                    aria-label={`Delete ${item.filename}`}
                    className="text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
                    onClick={() => void handleDelete(item.doc_id)}
                  >
                    {isDeleting ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  docId: string;
  filename: string;
  isShared: boolean;
  shareToken: string | null;
  onToggleShare: (next: boolean) => Promise<void>;
}

export function ShareDialog({
  open,
  onOpenChange,
  docId,
  filename,
  isShared,
  shareToken,
  onToggleShare,
}: ShareDialogProps) {
  const [copied, setCopied] = useState(false);
  const [toggling, setToggling] = useState(false);

  const shareUrl =
    isShared && shareToken
      ? `${window.location.origin}/?doc=${encodeURIComponent(docId)}&share=${encodeURIComponent(shareToken)}`
      : "";

  const handleToggle = async (next: boolean) => {
    setToggling(true);
    try {
      await onToggleShare(next);
    } finally {
      setToggling(false);
    }
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            Share &ldquo;{filename}&rdquo;
          </DialogTitle>
          <DialogDescription>
            Anyone with the link can open, edit, sign, and save changes back to
            this document.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between rounded-xl border bg-secondary/70 px-3.5 py-3">
          <div>
            <div className="text-xs font-medium text-foreground">
              Enable shareable edit link
            </div>
            <div className="text-[11px] text-muted-foreground">
              Turning this off immediately revokes the link
            </div>
          </div>
          <Switch
            checked={isShared}
            disabled={toggling}
            onCheckedChange={(v) => void handleToggle(v)}
            aria-label="Enable shareable link"
          />
        </div>

        {isShared && shareUrl && (
          <div className="flex items-center gap-2">
            <Input
              readOnly
              value={shareUrl}
              className="h-8 font-mono text-[11px]"
              onFocus={(e) => e.currentTarget.select()}
            />
            <Button
              type="button"
              size="default"
              variant="secondary"
              onClick={() => void handleCopy()}
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-[#3ecf8e]" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  Copy
                </>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
