import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  actions?: ReactNode;
  compact?: boolean;
  className?: string;
}

/**
 * Reusable dashed empty-state surface for lists, folders, and asset libraries.
 */
export function EmptyState({
  icon,
  title,
  description,
  actions,
  compact = false,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#2a2b2f] bg-[#141516]/50 text-center",
        compact ? "min-h-36 gap-1 px-4 py-6" : "px-6 py-14",
        className,
      )}
    >
      {icon && (
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-[#2a2b2f] bg-[#141516] text-[#a1a1aa]">
          {icon}
        </div>
      )}
      <h2
        className={cn(
          "font-semibold text-[#f7f8f8]",
          compact ? "text-xs" : "text-sm",
        )}
      >
        {title}
      </h2>
      {description && (
        <p
          className={cn(
            "mt-1 max-w-xs leading-relaxed text-[#8a8f98]",
            compact ? "text-[11px]" : "text-xs",
          )}
        >
          {description}
        </p>
      )}
      {actions && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
          {actions}
        </div>
      )}
    </div>
  );
}
