import { useCallback, useState } from "react";

interface HistoryState<T> {
  entries: T[];
  index: number;
}

/**
 * Reusable undo/redo state stack hook.
 * Uses a single atomic state object so entries & cursor index never desync.
 */
export function useHistory<T>(initialPresent: T) {
  const [state, setState] = useState<HistoryState<T>>({
    entries: [initialPresent],
    index: 0,
  });

  const present = state.entries[state.index] ?? initialPresent;
  const canUndo = state.index > 0;
  const canRedo = state.index < state.entries.length - 1;

  const push = useCallback((updater: (prev: T) => T) => {
    setState((prev) => {
      const current = prev.entries[prev.index]!;
      const next = updater(current);
      const sliced = prev.entries.slice(0, prev.index + 1);
      return {
        entries: [...sliced, next],
        index: sliced.length,
      };
    });
  }, []);

  const undo = useCallback(() => {
    setState((prev) =>
      prev.index > 0 ? { ...prev, index: prev.index - 1 } : prev,
    );
  }, []);

  const redo = useCallback(() => {
    setState((prev) =>
      prev.index < prev.entries.length - 1
        ? { ...prev, index: prev.index + 1 }
        : prev,
    );
  }, []);

  const reset = useCallback((nextPresent: T) => {
    setState({ entries: [nextPresent], index: 0 });
  }, []);

  return {
    present,
    canUndo,
    canRedo,
    push,
    undo,
    redo,
    reset,
  };
}
