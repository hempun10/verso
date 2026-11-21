import * as React from "react";
import { cn } from "@/lib/utils";

export function Kbd({
  className,
  ...props
}: React.HTMLAttributes<HTMLElement>) {
  return (
    <kbd
      className={cn(
        "inline-flex h-4.5 min-w-[18px] items-center justify-center rounded border border-zinc-200 bg-zinc-100 px-1 font-sans text-[10px] font-medium text-zinc-700 shadow-[0_1px_0_rgba(0,0,0,0.06)]",
        className,
      )}
      {...props}
    />
  );
}
