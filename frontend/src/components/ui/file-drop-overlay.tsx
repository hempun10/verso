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
      className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-[#08090a]/80 p-6 backdrop-blur-xs"
    >
      <div className="flex w-full max-w-md flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-[#7170ff] bg-[#0f1011] px-8 py-12 text-center shadow-2xl">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#7170ff]/15 text-[#7170ff]">
          <Upload className="h-6 w-6" />
        </div>
        <div className="text-base font-semibold text-[#f7f8f8]">{title}</div>
        {subtitle && (
          <p className="text-xs text-[#a1a1aa] tabular-nums">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
