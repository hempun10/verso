import { useEffect, useRef, useState } from "react";

interface UseWindowFileDropOptions {
  onDropFiles: (files: File[]) => void;
  disabled?: boolean;
}

/**
 * Reusable whole-window OS file drag-and-drop hook.
 * Tracks nested dragenter/dragleave depth cleanly so hovering child elements never flickers.
 */
export function useWindowFileDrop({
  onDropFiles,
  disabled = false,
}: UseWindowFileDropOptions): boolean {
  const [isDragging, setIsDragging] = useState(false);
  const depthRef = useRef(0);
  const callbackRef = useRef(onDropFiles);
  callbackRef.current = onDropFiles;

  useEffect(() => {
    if (disabled) {
      depthRef.current = 0;
      setIsDragging(false);
      return;
    }

    const hasFiles = (e: DragEvent) =>
      Array.from(e.dataTransfer?.types ?? []).includes("Files");

    const onDragEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depthRef.current += 1;
      setIsDragging(true);
    };

    const onDragOver = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    };

    const onDragLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depthRef.current = Math.max(0, depthRef.current - 1);
      if (depthRef.current === 0) {
        setIsDragging(false);
      }
    };

    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depthRef.current = 0;
      setIsDragging(false);
      const dropped = Array.from(e.dataTransfer?.files ?? []);
      if (dropped.length > 0) {
        callbackRef.current(dropped);
      }
    };

    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, [disabled]);

  return isDragging;
}
