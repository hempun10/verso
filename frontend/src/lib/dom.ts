/**
 * Reusable DOM & input helpers for keyboard-shortcut guards.
 */

/** Returns true when keyboard focus is inside a text input, textarea, select, or contentEditable. */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT" ||
    target.isContentEditable
  );
}
