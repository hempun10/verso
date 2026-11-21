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
        className={cn("h-4 w-4 shrink-0 text-[#7170ff]", className)}
      />
    );
  }
  return (
    <FileText
      className={cn("h-4 w-4 shrink-0 text-[#8a8f98]", className)}
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
        "rounded bg-[#1a1b1f] px-1.5 py-0.5 font-mono text-[9px] font-medium text-[#8a8f98] uppercase",
        className,
      )}
    >
      {isImageFilename(filename) ? "IMG" : "PDF"}
    </span>
  );
}
