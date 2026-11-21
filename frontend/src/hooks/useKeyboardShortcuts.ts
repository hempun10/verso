import { useEffect, useRef } from "react";

/**
 * Reusable window keydown subscription using a latest-handler ref so the DOM
 * listener attaches once instead of re-subscribing on every state update.
 */
export function useWindowKeyDown(
  handler: (event: KeyboardEvent) => void,
  enabled = true,
): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!enabled) return;
    const listener = (event: KeyboardEvent) => handlerRef.current(event);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [enabled]);
}
