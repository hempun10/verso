import { cn } from "@/lib/utils";

export const BRAND_NAME = "verso";

interface BrandLogoProps {
  size?: number;
  className?: string;
}

/**
 * Custom geometric folded-page "V" monogram for verso.
 * Crisp monochrome paper planes with a subtle #7170ff corner fold accent.
 */
export function BrandLogo({ size = 24, className }: BrandLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={cn("shrink-0", className)}
    >
      <rect width="32" height="32" rx="8" fill="#f7f8f8" />
      {/* Left ascending sheet plane */}
      <path
        d="M7.5 9.5L14.2 23.5H17.8L12.3 9.5H7.5Z"
        fill="#08090a"
      />
      {/* Right folded sheet plane */}
      <path
        d="M19.7 9.5L15.4 20.6L17.8 23.5L24.5 9.5H19.7Z"
        fill="#7170ff"
      />
      {/* Crisp page crease triangle */}
      <path d="M19.7 9.5L24.5 9.5L22.1 14.5L19.7 9.5Z" fill="#08090a" fillOpacity="0.22" />
    </svg>
  );
}
