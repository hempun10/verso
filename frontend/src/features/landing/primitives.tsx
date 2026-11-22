import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function PageFrame({ children }: { children: ReactNode }) {
  return (
    <div className="relative mx-auto max-w-7xl md:border-x md:border-border">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-0 left-6 z-10 hidden h-full w-px border-l border-border md:block"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-0 right-6 z-10 hidden h-full w-px border-r border-border md:block"
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
        "pointer-events-none absolute top-0 hidden h-full w-14 bg-landing-stripes text-foreground/5 md:block",
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
      <div className="relative w-full border-x border-border md:mx-10">
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
    <div className={cn("text-body-sm font-medium text-brand", className)}>
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
        "h-full w-full border-b border-border p-6 md:p-14",
        className,
      )}
    >
      <div className="mx-auto flex max-w-xl flex-col items-center justify-center gap-2 text-center">
        {eyebrow ? <Eyebrow className="mb-1">{eyebrow}</Eyebrow> : null}
        <h2 className="text-3xl font-medium tracking-tighter text-balance text-foreground md:text-4xl">
          {title}
        </h2>
        {sub ? (
          <p className="text-body-md font-medium text-balance text-subtle-foreground">
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
        "group/btn relative inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-lg bg-white text-body-sm font-semibold whitespace-nowrap text-background shadow-cta transition-[transform,background-color] duration-100 ease-out outline-none hover:bg-cta-hover focus-visible:ring-2 focus-visible:ring-brand/60 active:scale-98 active:bg-cta-active disabled:pointer-events-none disabled:opacity-50",
        size === "sm" && "h-7.5 pr-8.5 pl-3 text-xs",
        size === "default" && "h-8.5 pr-9.5 pl-3.5",
        size === "lg" && "h-9.5 pr-10.5 pl-4",
        full && size === "lg" && "w-full pl-10.5",
        !full && "justify-start",
        className,
      )}
    >
      <span>{children}</span>
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute top-1 right-1 bottom-1 grid place-items-center rounded-md bg-black/8 shadow-inset-badge transition-colors duration-150 group-hover/btn:bg-black/11",
          size === "sm" && "w-5.5",
          size === "default" && "w-6.5",
          size === "lg" && "w-7.5",
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
        "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg border border-input bg-accent text-body-sm font-semibold whitespace-nowrap text-subtle-foreground shadow-raised transition-[transform,background-color,color] duration-100 ease-out outline-none hover:bg-surface-active hover:text-foreground focus-visible:ring-2 focus-visible:ring-brand/60 active:scale-98 disabled:pointer-events-none disabled:opacity-50",
        size === "sm" && "h-7.5 px-3 text-xs",
        size === "default" && "h-8.5 px-3.5",
        size === "lg" && "h-9.5 px-4",
        className,
      )}
    >
      {children}
    </button>
  );
}
