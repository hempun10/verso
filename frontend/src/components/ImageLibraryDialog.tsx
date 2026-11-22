import { useRef, useState } from "react";
import { ImagePlus, Loader2, Stamp, Trash2, Upload } from "lucide-react";
import { AlertBanner } from "@/components/ui/alert-banner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DEFAULT_UPLOAD_LIMITS,
  formatFileSize,
  validateImageFileClient,
} from "@/lib/validation";
import type { AssetItem, UploadLimits } from "@/types";

interface ImageLibraryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  savedImages: AssetItem[];
  loading?: boolean;
  limits?: UploadLimits;
  onUploadAndPlace: (file: File) => Promise<void>;
  onPlaceSavedImage: (asset: AssetItem) => void;
  onDeleteSavedImage: (assetId: string) => Promise<void>;
  onOpenStampStudio: (opts?: {
    file?: File;
    asset?: AssetItem;
  }) => void;
}

export function ImageLibraryDialog({
  open,
  onOpenChange,
  savedImages,
  loading = false,
  limits = DEFAULT_UPLOAD_LIMITS,
  onUploadAndPlace,
  onPlaceSavedImage,
  onDeleteSavedImage,
  onOpenStampStudio,
}: ImageLibraryDialogProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const stampInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setLocalError(null);
    }
    onOpenChange(nextOpen);
  };

  const handleFile = async (file: File) => {
    setLocalError(null);
    const validationError = validateImageFileClient(file, limits);
    if (validationError) {
      setLocalError(validationError);
      return;
    }

    setUploading(true);
    try {
      await onUploadAndPlace(file);
      handleOpenChange(false);
    } catch (err: unknown) {
      setLocalError(
        err instanceof Error ? err.message : "Failed to upload image.",
      );
    } finally {
      setUploading(false);
    }
  };

  const handleStampFile = (file: File) => {
    setLocalError(null);
    const validationError = validateImageFileClient(file, limits);
    if (validationError) {
      setLocalError(validationError);
      return;
    }
    handleOpenChange(false);
    onOpenStampStudio({ file });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Images, Stamps &amp; Watermarks</DialogTitle>
          <DialogDescription>
            Upload a PNG, JPG, or WebP up to{" "}
            {formatFileSize(limits.max_image_bytes)}, convert any logo into an
            official stamp, or reuse a saved item from your library.
          </DialogDescription>
        </DialogHeader>

        <input
          ref={inputRef}
          type="file"
          accept={limits.allowed_image_types.join(",")}
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
            e.target.value = "";
          }}
        />
        <input
          ref={stampInputRef}
          type="file"
          accept={limits.allowed_image_types.join(",")}
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleStampFile(file);
            e.target.value = "";
          }}
        />

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <button
            type="button"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-input bg-secondary/70 px-4 py-5 text-center transition-colors hover:border-ring/60 hover:bg-accent/70"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-input bg-card text-foreground shadow-xs">
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
            </div>
            <div className="text-xs font-medium text-foreground">
              {uploading ? "Uploading image..." : "Upload image"}
            </div>
            <p className="text-label leading-snug text-muted-foreground">
              Place PNG, JPG, or WebP directly on the page
            </p>
          </button>

          <div className="flex flex-col justify-between gap-2 rounded-xl border border-dashed border-brand/45 bg-brand/[0.06] px-4 py-5 text-center transition-colors hover:border-brand/75 hover:bg-brand/[0.1]">
            <button
              type="button"
              onClick={() => stampInputRef.current?.click()}
              className="flex flex-1 cursor-pointer flex-col items-center justify-center gap-2"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-brand/40 bg-brand/15 text-brand-soft shadow-xs">
                <Stamp className="h-4 w-4" />
              </div>
              <div className="text-xs font-medium text-foreground">
                Open as stamp
              </div>
              <p className="text-label leading-snug text-muted-foreground">
                Remove background &amp; convert logo into official seal
              </p>
            </button>
            <button
              type="button"
              onClick={() => {
                onOpenChange(false);
                onOpenStampStudio();
              }}
              className="cursor-pointer text-label font-medium text-brand-soft hover:text-foreground hover:underline"
            >
              Or open Stamp Studio without a logo
            </button>
          </div>
        </div>

        {localError && <AlertBanner message={localError} />}

        {loading && savedImages.length === 0 ? (
          <div className="space-y-2">
            <Skeleton className="h-3.5 w-28" />
            <div className="grid grid-cols-3 gap-2.5">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="space-y-2 rounded-xl border border-border bg-secondary p-2"
                >
                  <Skeleton className="h-16 w-full rounded-md" />
                  <Skeleton className="h-3 w-16" />
                </div>
              ))}
            </div>
          </div>
        ) : (
          savedImages.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-foreground/90">
                <ImagePlus className="h-3.5 w-3.5 text-muted-foreground" />
                <span>Saved images &amp; stamps ({savedImages.length})</span>
              </div>
              <div className="grid max-h-55 grid-cols-3 gap-2.5 overflow-y-auto pr-1">
                {savedImages.map((img) => {
                  const isDeleting = deletingId === img.asset_id;
                  return (
                    <div
                      key={img.asset_id}
                      className="flex flex-col justify-between rounded-xl border border-border bg-secondary p-2 transition-colors hover:border-input"
                    >
                      <button
                        type="button"
                        className="flex h-16 w-full cursor-pointer items-center justify-center rounded-md bg-white/95 p-1"
                        onClick={() => {
                          onPlaceSavedImage(img);
                          onOpenChange(false);
                        }}
                      >
                        <img
                          src={img.url}
                          alt={img.name}
                          className="max-h-14 max-w-full object-contain"
                        />
                      </button>
                      <div className="mt-1.5 flex items-center justify-between gap-1">
                        <span
                          className="truncate text-label text-foreground/90"
                          title={img.name}
                        >
                          {img.name}
                        </span>
                        <div className="flex shrink-0 items-center gap-0.5">
                          <button
                            type="button"
                            title="Open as stamp"
                            aria-label={`Open ${img.name} as stamp`}
                            className="cursor-pointer rounded p-0.5 text-muted-foreground hover:bg-brand/18 hover:text-brand-soft"
                            onClick={() => {
                              onOpenChange(false);
                              onOpenStampStudio({ asset: img });
                            }}
                          >
                            <Stamp className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            disabled={isDeleting}
                            aria-label={`Delete ${img.name}`}
                            className="cursor-pointer rounded p-0.5 text-muted-foreground hover:bg-destructive/15 hover:text-destructive disabled:opacity-50"
                            onClick={async () => {
                              setDeletingId(img.asset_id);
                              try {
                                await onDeleteSavedImage(img.asset_id);
                              } finally {
                                setDeletingId(null);
                              }
                            }}
                          >
                            {isDeleting ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Trash2 className="h-3 w-3" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )
        )}

        <div className="flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
