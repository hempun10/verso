import { useState } from "react";
import { Upload } from "lucide-react";
import { TurnstileWidget } from "@/components/TurnstileWidget";
import { cn } from "@/lib/utils";
import { formatFileSize } from "@/lib/validation";
import type { UploadLimits } from "@/types";
import { WORKS_ON } from "./FeatureVisuals";
import { PrimaryCtaButton, SecondaryButton } from "./primitives";

interface LandingHeroProps {
  uploadLimits: UploadLimits;
  captchaRequired: boolean;
  turnstileSiteKey: string;
  uploadCaptchaToken: string | null;
  uploadCaptchaResetKey: number;
  onCaptchaToken: (token: string | null) => void;
  onChooseFile: () => void;
  onUploadFiles: (files: File[]) => void;
  onOpenDashboard: () => void;
}

export function LandingHero({
  uploadLimits,
  captchaRequired,
  turnstileSiteKey,
  uploadCaptchaToken,
  uploadCaptchaResetKey,
  onCaptchaToken,
  onChooseFile,
  onUploadFiles,
  onOpenDashboard,
}: LandingHeroProps) {
  const [isDragging, setIsDragging] = useState(false);

  return (
    <section id="hero" className="relative w-full">
      <div className="relative flex w-full flex-col items-center px-6">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 -z-10 h-[560px] w-full rounded-b-xl [background:radial-gradient(125%_125%_at_50%_10%,#08090a_40%,rgba(113,112,255,0.28)_100%)] md:h-[760px]" />
        </div>

        <div className="relative z-10 mx-auto flex w-full max-w-3xl flex-col items-center justify-center gap-7 pt-16 md:gap-9 md:pt-24">
          <div className="flex flex-col items-center justify-center gap-5">
            <h1 className="text-center text-[32px] leading-[1.06] font-medium tracking-tighter text-balance text-[#f7f8f8] sm:text-5xl md:text-6xl xl:text-[68px] xl:leading-[1.02]">
              Edit any PDF or image.
              <br />
              Keep every detail.
            </h1>
            <p className="max-w-[54ch] text-center text-base leading-relaxed font-medium tracking-tight text-balance text-[#a1a1aa] md:text-lg">
              Fix text inside PDFs, screenshots, or photos of forms. Sign
              contracts, hide private details, and place logos — then download
              cleanly.
            </p>
          </div>

          <div className="flex flex-col items-center gap-5">
            <div className="flex flex-wrap items-center justify-center gap-3">
              <PrimaryCtaButton
                onClick={onChooseFile}
                disabled={captchaRequired && !uploadCaptchaToken}
              >
                Choose a file
              </PrimaryCtaButton>
              <SecondaryButton onClick={onOpenDashboard}>
                Open dashboard
              </SecondaryButton>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[13px] text-[#8a8f98]">
              <span className="text-xs font-medium text-[#62666d]">
                Made for
              </span>
              {WORKS_ON.map((item) => (
                <span key={item} className="inline-flex items-center gap-1.5">
                  <span className="h-1 w-1 rounded-full bg-[#7170ff]/75" />
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
              onChooseFile();
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
            if (dropped.length > 0) onUploadFiles(dropped);
          }}
          onClick={onChooseFile}
          className={cn(
            "group relative mx-auto flex w-full max-w-2xl cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed px-6 py-12 text-center transition-colors duration-200 sm:py-14",
            isDragging
              ? "border-[#7170ff] bg-[#7170ff]/[0.08] ring-2 ring-[#7170ff]/35"
              : "border-[#2a2b2f] bg-[#0f1011] hover:border-[#3f4149] hover:bg-[#121316]",
          )}
        >
          <div
            className={cn(
              "flex h-12 w-12 items-center justify-center rounded-xl border transition-transform duration-150 group-hover:scale-105",
              isDragging
                ? "border-[#7170ff] bg-[#7170ff]/15 text-[#7170ff]"
                : "border-[#2a2b2f] bg-[#141516] text-[#f7f8f8]",
            )}
          >
            <Upload className="h-5 w-5" />
          </div>

          <div className="mt-4 text-base font-medium tracking-tight text-[#f7f8f8] sm:text-lg">
            {isDragging
              ? "Release to open your file"
              : "Drop a PDF or image anywhere here"}
          </div>
          <p className="mt-1.5 max-w-md text-[14px] leading-relaxed text-[#a1a1aa]">
            Or click to browse from your computer. Click any text to edit it in
            place, sign, and export as PDF or PNG.
          </p>

          {captchaRequired && turnstileSiteKey && (
            <div
              className="mt-5 flex flex-col items-center gap-1.5"
              onClick={(e) => e.stopPropagation()}
            >
              <TurnstileWidget
                siteKey={turnstileSiteKey}
                resetKey={uploadCaptchaResetKey}
                onToken={onCaptchaToken}
              />
              {!uploadCaptchaToken && (
                <p className="text-[11px] text-[#8a8f98]">
                  Complete human verification before uploading
                </p>
              )}
            </div>
          )}

          <div className="mt-6">
            <PrimaryCtaButton disabled={captchaRequired && !uploadCaptchaToken}>
              Choose PDF or image
            </PrimaryCtaButton>
          </div>

          <p className="mt-4 text-[12px] text-[#62666d] tabular-nums">
            PDF up to {formatFileSize(uploadLimits.max_pdf_bytes)} · PNG, JPG,
            WebP up to {formatFileSize(uploadLimits.max_image_bytes)} · No
            signup needed
          </p>
        </div>
      </div>

      <div className="h-12 md:h-16" />
    </section>
  );
}
