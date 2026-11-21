import type { UploadLimits } from "@/types";

/**
 * Default upload limits aligned with Appwrite Storage bucket limits
 * (<= 50 MB bucket ceiling) and backend config defaults.
 */
export const MAX_BATCH_UPLOAD_FILES = 10;

export const DEFAULT_UPLOAD_LIMITS: UploadLimits = {
  max_pdf_bytes: 25_000_000,
  max_pdf_pages: 50,
  max_image_bytes: 5_000_000,
  allowed_image_types: ["image/png", "image/jpeg", "image/webp"],
};

const IMAGE_EXTENSION_TO_MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

export function isImageFilename(filename: string): boolean {
  return /\.(png|jpe?g|webp)$/i.test(filename);
}

export function formatFileSize(bytes: number): string {
  if (bytes >= 1_000_000) {
    const mb = bytes / 1_000_000;
    return `${Number.isInteger(mb) ? mb : mb.toFixed(1)} MB`;
  }
  if (bytes >= 1_000) {
    return `${Math.round(bytes / 1_000)} KB`;
  }
  return `${bytes} B`;
}

async function hasValidImageHeader(file: File): Promise<boolean> {
  try {
    const buf = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (
      buf.length >= 8 &&
      buf[0] === 0x89 &&
      buf[1] === 0x50 &&
      buf[2] === 0x4e &&
      buf[3] === 0x47
    ) {
      return true;
    }
    // JPEG: FF D8 FF
    if (
      buf.length >= 3 &&
      buf[0] === 0xff &&
      buf[1] === 0xd8 &&
      buf[2] === 0xff
    ) {
      return true;
    }
    // WebP: RIFF....WEBP
    if (
      buf.length >= 12 &&
      buf[0] === 0x52 &&
      buf[1] === 0x49 &&
      buf[2] === 0x46 &&
      buf[3] === 0x46 &&
      buf[8] === 0x57 &&
      buf[9] === 0x45 &&
      buf[10] === 0x42 &&
      buf[11] === 0x50
    ) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Client-side PDF or Image validation run BEFORE uploading any bytes to the server/Appwrite.
 * Supports PDFs (<= max_pdf_bytes, %PDF- magic header) and PNG/JPG/WebP images
 * (<= max_image_bytes, image magic header) for OCR text editing.
 */
export async function validateDocumentFileClient(
  file: File,
  limits: UploadLimits = DEFAULT_UPLOAD_LIMITS,
): Promise<string | null> {
  if (file.size <= 0) {
    return "This file is empty. Please choose a valid PDF or image.";
  }

  const lowerName = file.name.toLowerCase();
  const hasPdfExt = lowerName.endsWith(".pdf");
  const hasPdfMime = file.type === "application/pdf";

  const matchedImgExt = Object.keys(IMAGE_EXTENSION_TO_MIME).find((ext) =>
    lowerName.endsWith(ext),
  );
  const inferredImgMime =
    (file.type && limits.allowed_image_types.includes(file.type)
      ? file.type
      : "") || (matchedImgExt ? IMAGE_EXTENSION_TO_MIME[matchedImgExt] : "");

  if (hasPdfExt || hasPdfMime) {
    if (file.size > limits.max_pdf_bytes) {
      return `PDF is too large (${formatFileSize(file.size)}). Maximum allowed size is ${formatFileSize(limits.max_pdf_bytes)}.`;
    }
    try {
      const header = await file.slice(0, 5).text();
      if (header !== "%PDF-") {
        return "This file is not a valid PDF document (missing %PDF- header).";
      }
    } catch {
      return "Could not read the selected file.";
    }
    return null;
  }

  if (inferredImgMime && limits.allowed_image_types.includes(inferredImgMime)) {
    if (file.size > limits.max_image_bytes) {
      return `Image is too large (${formatFileSize(file.size)}). Maximum allowed size is ${formatFileSize(limits.max_image_bytes)}.`;
    }
    const okHeader = await hasValidImageHeader(file);
    if (!okHeader) {
      return "This file is not a valid PNG, JPG, or WebP image.";
    }
    return null;
  }

  return "Only PDF and image files (PNG, JPG, WebP) are supported.";
}

/** Backwards-compatible alias for PDF/document upload validation. */
export const validatePdfFileClient = validateDocumentFileClient;

/**
 * Client-side image overlay validation run BEFORE FileReader / network upload to Appwrite.
 * Verifies non-empty file, allowed MIME type (PNG/JPG/WebP), and size ceiling.
 */
export function validateImageFileClient(
  file: File,
  limits: UploadLimits = DEFAULT_UPLOAD_LIMITS,
): string | null {
  if (file.size <= 0) {
    return "This image file is empty.";
  }

  const lowerName = file.name.toLowerCase();
  const matchedExt = Object.keys(IMAGE_EXTENSION_TO_MIME).find((ext) =>
    lowerName.endsWith(ext),
  );
  const inferredMime =
    file.type || (matchedExt ? IMAGE_EXTENSION_TO_MIME[matchedExt] : "");

  if (!inferredMime || !limits.allowed_image_types.includes(inferredMime)) {
    return "Unsupported image format. Please choose a PNG, JPG, or WebP image.";
  }

  if (file.size > limits.max_image_bytes) {
    return `Image is too large (${formatFileSize(file.size)}). Maximum allowed size is ${formatFileSize(limits.max_image_bytes)}.`;
  }

  return null;
}
