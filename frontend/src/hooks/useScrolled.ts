import { useEffect, useState } from "react";

/**
 * Reusable passive scroll-threshold hook (e.g. for sticky frosted headers).
 */
export function useScrolled(thresholdPx = 12): boolean {
  const [scrolled, setScrolled] = useState(
    () => typeof window !== "undefined" && window.scrollY > thresholdPx,
  );

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > thresholdPx);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [thresholdPx]);

  return scrolled;
}
