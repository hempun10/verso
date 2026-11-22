import { Upload } from "lucide-react";

interface FileDropOverlayProps {
  visible: boolean;
  title: string;
  subtitle?: string;
}

/**
 * Reusable full-window dropzone overlay paired with `useWindowFileDrop`.
 */
export function FileDropOverlay({
  visible,
  title,
  subtitle,
}: FileDropOverlayProps) {
  if (!visible) return null;

  return (
    <div
      data-page-drop-overlay="true"
      className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-6 backdrop-blur-xs"
    >
      <div className="flex w-full max-w-md flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-brand bg-card px-8 py-12 text-center shadow-2xl">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/15 text-brand">
          <Upload className="h-6 w-6" />
        </div>
        <div className="text-base font-semibold text-foreground">{title}</div>
        {subtitle && (
          <p className="text-xs text-subtle-foreground tabular-nums">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
