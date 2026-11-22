import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { subscribeServerWaking } from "@/api/client";

/**
 * Subtle floating indicator shown only when a sleeping backend container
 * is cold-starting and the client is automatically retrying boot requests.
 */
export function ServerWakeBanner() {
  const [waking, setWaking] = useState(false);

  useEffect(() => subscribeServerWaking(setWaking), []);

  if (!waking) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-brand/40 bg-popover px-4 py-2 text-xs font-medium text-foreground shadow-floating"
    >
      <Loader2 className="h-3.5 w-3.5 animate-spin text-brand" />
      <span>Waking up document server… usually ready in 15–45 seconds</span>
    </div>
  );
}
