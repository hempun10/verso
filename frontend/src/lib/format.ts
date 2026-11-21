/**
 * Reusable formatting, file-naming, and browser download utilities.
 * Framework-agnostic — safe to reuse across any TypeScript web project.
 */

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  if (bytes >= 1_000_000_000) {
    const gb = bytes / 1_000_000_000;
    return `${gb >= 10 ? gb.toFixed(1) : gb.toFixed(2)} GB`;
  }
  if (bytes >= 1_000_000) {
    const mb = bytes / 1_000_000;
    return `${mb >= 10 || Number.isInteger(mb) ? mb.toFixed(0) : mb.toFixed(1)} MB`;
  }
  if (bytes >= 1_000) {
    return `${Math.round(bytes / 1_000)} KB`;
  }
  return `${bytes} B`;
}

export function formatRelativeTime(epochSeconds: number): string {
  if (!epochSeconds) return "";
  const diff = Math.max(0, Math.floor(Date.now() / 1000 - epochSeconds));
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(epochSeconds * 1000).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function stripFileExtension(filename: string, fallback = "document"): string {
  return filename.replace(/\.[^.]+$/, "").trim() || fallback;
}

export function readFileAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("Could not read file."));
    reader.onerror = () => reject(new Error("Could not read file."));
    reader.readAsDataURL(file);
  });
}

export function triggerDownload(source: Blob | string, filename: string): void {
  const isBlob = source instanceof Blob;
  const href = isBlob ? URL.createObjectURL(source) : source;
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  link.click();
  if (isBlob) {
    URL.revokeObjectURL(href);
  }
}
