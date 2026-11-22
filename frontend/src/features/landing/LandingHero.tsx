import { useState } from "react";
import { Upload } from "lucide-react";
import { TurnstileWidget } from "@/components/TurnstileWidget";
import { useEditor } from "@/features/editor/EditorContext";
import { useWorkspace } from "@/features/workspace/WorkspaceContext";
import { cn } from "@/lib/utils";
import { formatFileSize } from "@/lib/validation";
import { WORKS_ON } from "./FeatureVisuals";
import { PrimaryCtaButton, SecondaryButton } from "./primitives";

export function LandingHero() {
  const { authConfig, isSignedIn, uploadLimits, captchaRequired, setAuthOpen } =
    useWorkspace();
  const { upload, chooseFile, openDashboard } = useEditor();
  const [isDragging, setIsDragging] = useState(false);

  const turnstileSiteKey = authConfig?.turnstile_site_key ?? "";
  const uploadDisabled =
    isSignedIn && captchaRequired && !upload.uploadCaptchaToken;
  const handleChoose = () => {
    if (!isSignedIn) {
      setAuthOpen(true);
      return;
    }
    chooseFile(null, true);
  };

  return (
    <section id="hero" className="relative w-full">
      <div className="relative flex w-full flex-col items-center px-6">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 -z-10 h-140 w-full rounded-b-xl bg-hero-glow md:h-190" />
        </div>

        <div className="relative z-10 mx-auto flex w-full max-w-3xl flex-col items-center justify-center gap-7 pt-16 md:gap-9 md:pt-24">
          <div className="flex flex-col items-center justify-center gap-5">
            <h1 className="text-center text-3xl leading-[1.06] font-medium tracking-tighter text-balance text-foreground sm:text-5xl md:text-6xl xl:text-hero xl:leading-[1.02]">
              Edit any PDF or image.
              <br />
              Keep every detail.
            </h1>
            <p className="max-w-[54ch] text-center text-base leading-relaxed font-medium tracking-tight text-balance text-subtle-foreground md:text-lg">
              Fix text inside PDFs, screenshots, or photos of forms. Sign
              contracts, hide private details, and place logos — then download
              cleanly.
            </p>
          </div>

          <div className="flex flex-col items-center gap-5">
            <div className="flex flex-wrap items-center justify-center gap-3">
              <PrimaryCtaButton onClick={handleChoose} disabled={uploadDisabled}>
                {isSignedIn ? "Choose a file" : "Sign in to start"}
              </PrimaryCtaButton>
              <SecondaryButton onClick={openDashboard}>
                Open dashboard
              </SecondaryButton>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-body-sm text-muted-foreground">
              <span className="text-xs font-medium text-dim-foreground">
                Made for
              </span>
              {WORKS_ON.map((item) => (
                <span key={item} className="inline-flex items-center gap-1.5">
                  <span className="h-1 w-1 rounded-full bg-brand/75" />
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Hero Upload Dropzone */}
      <div className="relative mt-10 px-4 sm:px-8 md:px-12">
        <div
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleChoose();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            const dropped = Array.from(e.dataTransfer.files ?? []);
            if (dropped.length > 0) void upload.handleUploadFiles(dropped, null);
          }}
          onClick={handleChoose}
          className={cn(
            "group relative mx-auto flex w-full max-w-2xl cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed px-6 py-12 text-center transition-colors duration-200 sm:py-14",
            isDragging
              ? "border-brand bg-brand/8 ring-2 ring-brand/35"
              : "border-input bg-card hover:border-border-hover hover:bg-card",
          )}
        >
          <div
            className={cn(
              "flex h-12 w-12 items-center justify-center rounded-xl border transition-transform duration-150 group-hover:scale-105",
              isDragging
                ? "border-brand bg-brand/15 text-brand"
                : "border-input bg-secondary text-foreground",
            )}
          >
            <Upload className="h-5 w-5" />
          </div>

          <div className="mt-4 text-base font-medium tracking-tight text-foreground sm:text-lg">
            {isDragging
              ? "Release to open your file"
              : "Drop a PDF or image anywhere here"}
          </div>
          <p className="mt-1.5 max-w-md text-sm leading-relaxed text-subtle-foreground">
            Or click to browse from your computer. Click any text to edit it in
            place, sign, and export as PDF or PNG.
          </p>

          {isSignedIn && captchaRequired && turnstileSiteKey && (
            <div
              className="mt-5 flex flex-col items-center gap-1.5"
              onClick={(e) => e.stopPropagation()}
            >
              <TurnstileWidget
                siteKey={turnstileSiteKey}
                resetKey={upload.uploadCaptchaResetKey}
                onToken={upload.setUploadCaptchaToken}
              />
              {!upload.uploadCaptchaToken && (
                <p className="text-label text-muted-foreground">
                  Complete human verification before uploading
                </p>
              )}
            </div>
          )}

          <div className="mt-6">
            <PrimaryCtaButton disabled={uploadDisabled}>
              {isSignedIn ? "Choose PDF or image" : "Sign in to upload"}
            </PrimaryCtaButton>
          </div>

          <p className="mt-4 text-xs text-dim-foreground tabular-nums">
            PDF up to {formatFileSize(uploadLimits.max_pdf_bytes)} · PNG, JPG,
            WebP up to {formatFileSize(uploadLimits.max_image_bytes)} ·{" "}
            {isSignedIn
              ? "Synced to your workspace"
              : "Free sign-in required"}
          </p>
        </div>
      </div>

      <div className="h-12 md:h-16" />
    </section>
  );
}
