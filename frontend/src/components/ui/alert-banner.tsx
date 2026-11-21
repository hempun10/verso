import { AlertCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface AlertBannerProps {
  message: string;
  onDismiss?: () => void;
  className?: string;
}

/**
 * Reusable accessible error banner (`role="alert"`) with optional dismiss action.
 */
export function AlertBanner({
  message,
  onDismiss,
  className,
}: AlertBannerProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start justify-between gap-2 rounded-lg border border-destructive/35 bg-destructive/12 px-3 py-2 text-xs text-[#f7d8d2]",
        className,
      )}
    >
      <div className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
        <span>{message}</span>
      </div>
      {onDismiss && (
        <button
          type="button"
          aria-label="Dismiss alert"
          onClick={onDismiss}
          className="cursor-pointer rounded p-0.5 text-[#f7d8d2]/75 transition-colors hover:bg-destructive/20 hover:text-white"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
