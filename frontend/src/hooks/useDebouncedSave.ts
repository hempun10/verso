import { useEffect, useRef } from "react";

interface UseDebouncedAutoSaveOptions {
  enabled: boolean;
  serializedKey: string;
  lastSavedKey: string;
  delayMs?: number;
  onDirty?: () => void;
  onSave: () => Promise<void> | void;
}

/**
 * Reusable debounced auto-save hook for document/form editors.
 * Only schedules a save when `serializedKey` diverges from `lastSavedKey`.
 */
export function useDebouncedAutoSave({
  enabled,
  serializedKey,
  lastSavedKey,
  delayMs = 1100,
  onDirty,
  onSave,
}: UseDebouncedAutoSaveOptions): void {
  const callbacksRef = useRef({ onDirty, onSave });
  callbacksRef.current = { onDirty, onSave };

  useEffect(() => {
    if (!enabled || serializedKey === lastSavedKey) return;
    callbacksRef.current.onDirty?.();
    const timer = window.setTimeout(() => {
      void callbacksRef.current.onSave();
    }, delayMs);
    return () => window.clearTimeout(timer);
  }, [delayMs, enabled, lastSavedKey, serializedKey]);
}
