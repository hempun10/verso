import * as React from "react";
import { cn } from "@/lib/utils";

export function Kbd({
  className,
  ...props
}: React.HTMLAttributes<HTMLElement>) {
  return (
    <kbd
      className={cn(
        "inline-flex h-4.5 min-w-4.5 items-center justify-center rounded border border-zinc-200 bg-zinc-100 px-1 font-sans text-2xs font-medium text-zinc-700 shadow-xs",
        className,
      )}
      {...props}
    />
  );
}
