import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function PageFrame({ children }: { children: ReactNode }) {
  return (
    <div className="relative mx-auto max-w-7xl md:border-x md:border-[#1f2023]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-0 left-6 z-10 hidden h-full w-px border-l border-[#1f2023] md:block"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-0 right-6 z-10 hidden h-full w-px border-r border-[#1f2023] md:block"
      />
      {children}
    </div>
  );
}

export function Stripes({ side }: { side: "left" | "right" }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute top-0 hidden h-full w-14 bg-[size:10px_10px] text-[#f7f8f8]/5 [background-image:repeating-linear-gradient(315deg,currentColor_0_1px,#0000_0_50%)] md:block",
        side === "left" ? "-left-14" : "-right-14",
      )}
    />
  );
}

export function Framed({
  id,
  children,
  className,
}: {
  id?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={cn(
        "relative flex w-full scroll-mt-20 flex-col items-center justify-center px-0 md:px-10",
        className,
      )}
    >
      <div className="relative w-full border-x border-[#1f2023] md:mx-10">
        <Stripes side="left" />
        <Stripes side="right" />
        {children}
      </div>
    </section>
  );
}

export function Eyebrow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("text-[13px] font-medium text-[#7170ff]", className)}>
      {children}
    </div>
  );
}

export function SectionHeader({
  title,
  sub,
  eyebrow,
  className,
}: {
  title: ReactNode;
  sub?: ReactNode;
  eyebrow?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "h-full w-full border-b border-[#1f2023] p-6 md:p-14",
        className,
      )}
    >
      <div className="mx-auto flex max-w-xl flex-col items-center justify-center gap-2 text-center">
        {eyebrow ? <Eyebrow className="mb-1">{eyebrow}</Eyebrow> : null}
        <h2 className="text-3xl font-medium tracking-tighter text-balance text-[#f7f8f8] md:text-4xl">
          {title}
        </h2>
        {sub ? (
          <p className="text-[15px] font-medium text-balance text-[#a1a1aa]">
            {sub}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/** Primary high-contrast white button with inset arrow box. */
export function PrimaryCtaButton({
  children,
  onClick,
  disabled,
  size = "lg",
  full = false,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  size?: "sm" | "default" | "lg";
  full?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "group/btn relative inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-lg bg-white text-[13px] font-semibold whitespace-nowrap text-[#08090a] shadow-[inset_0_-1px_0_rgba(0,0,0,0.14),0_1px_2px_rgba(0,0,0,0.4)] transition-[transform,background-color] duration-100 ease-out outline-none hover:bg-[#f4f4f6] focus-visible:ring-2 focus-visible:ring-[#7170ff]/60 active:scale-[0.98] active:bg-[#e8e8ec] disabled:pointer-events-none disabled:opacity-50",
        size === "sm" && "h-[30px] pr-[34px] pl-3 text-xs",
        size === "default" && "h-[34px] pr-[38px] pl-3.5",
        size === "lg" && "h-[38px] pr-[42px] pl-4",
        full && size === "lg" && "w-full pl-[42px]",
        !full && "justify-start",
        className,
      )}
    >
      <span>{children}</span>
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute top-1 right-1 bottom-1 grid place-items-center rounded-md bg-black/[0.08] shadow-[inset_0_1px_1px_rgba(0,0,0,0.12)] transition-colors duration-150 group-hover/btn:bg-black/[0.11]",
          size === "sm" && "w-[22px]",
          size === "default" && "w-[26px]",
          size === "lg" && "w-[30px]",
        )}
      >
        <ArrowRight className="h-3.5 w-3.5 stroke-[2.2]" />
      </span>
    </button>
  );
}

/** Raised dark secondary button. */
export function SecondaryButton({
  children,
  onClick,
  disabled,
  size = "lg",
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  size?: "sm" | "default" | "lg";
  className?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#2a2b2f] bg-[#1c1d1f] text-[13px] font-semibold whitespace-nowrap text-[#a1a1aa] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition-[transform,background-color,color] duration-100 ease-out outline-none hover:bg-[#232428] hover:text-[#f7f8f8] focus-visible:ring-2 focus-visible:ring-[#7170ff]/60 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
        size === "sm" && "h-[30px] px-3 text-xs",
        size === "default" && "h-[34px] px-3.5",
        size === "lg" && "h-[38px] px-4",
        className,
      )}
    >
      {children}
    </button>
  );
}
