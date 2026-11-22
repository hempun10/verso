import { FileText, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { isImageFilename } from "@/lib/validation";

interface FileTypeIconProps {
  filename: string;
  className?: string;
}

/** Content-aware document icon (image vs PDF). */
export function FileTypeIcon({ filename, className }: FileTypeIconProps) {
  const isImg = isImageFilename(filename);
  if (isImg) {
    return (
      <ImageIcon
        className={cn("h-4 w-4 shrink-0 text-brand", className)}
      />
    );
  }
  return (
    <FileText
      className={cn("h-4 w-4 shrink-0 text-muted-foreground", className)}
    />
  );
}

interface FileTypeBadgeProps {
  filename: string;
  className?: string;
}

/** Compact monospace pill showing IMG or PDF based on filename. */
export function FileTypeBadge({ filename, className }: FileTypeBadgeProps) {
  return (
    <span
      className={cn(
        "rounded bg-surface-hover px-1.5 py-0.5 font-mono text-3xs font-medium text-muted-foreground uppercase",
        className,
      )}
    >
      {isImageFilename(filename) ? "IMG" : "PDF"}
    </span>
  );
}
