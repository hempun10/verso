import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { useEditor } from "@/features/editor/EditorContext";
import { useWorkspace } from "@/features/workspace/WorkspaceContext";
import { cn } from "@/lib/utils";
import { formatFileSize } from "@/lib/validation";
import { SHOWCASE_ROWS, STEPS } from "./FeatureVisuals";
import {
  Eyebrow,
  Framed,
  PrimaryCtaButton,
  SecondaryButton,
  SectionHeader,
} from "./primitives";

export function LandingSections() {
  const { isSignedIn, uploadLimits, captchaRequired, setAuthOpen } =
    useWorkspace();
  const { upload, chooseFile } = useEditor();
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const uploadDisabled =
    isSignedIn && captchaRequired && !upload.uploadCaptchaToken;
  const handleChoose = () => {
    if (!isSignedIn) {
      setAuthOpen(true);
      return;
    }
    chooseFile(null, true);
  };

  const faqRows: [string, string][] = [
    [
      "Do I need an account to edit a file?",
      "Yes — sign in free with Google or GitHub to upload PDFs or images, edit text, add signatures or stamps, and keep your folders synced in your dashboard.",
    ],
    [
      "Does it work on scanned documents and images?",
      "Yes. Whether your file is a regular PDF, a scanned paper form, or a PNG/JPG screenshot, you can click text to edit it, cover old details, and place signatures on top.",
    ],
    [
      "Will editing a word mess up the rest of my page?",
      "No. Only the exact part you change is updated — margins, tables, photos, and untouched text stay right where they are.",
    ],
    [
      "What file sizes and page counts are supported?",
      `You can upload PDFs up to ${formatFileSize(uploadLimits.max_pdf_bytes)} and up to ${uploadLimits.max_pdf_pages} pages, plus PNG, JPG, or WebP images up to ${formatFileSize(uploadLimits.max_image_bytes)}.`,
    ],
    [
      "Can I organize my files into folders?",
      "Yes. Open your dashboard to create folders and subfolders, upload PDFs or images directly into a folder, move files around, and reopen any document in one click.",
    ],
  ];

  return (
    <>
      <Framed id="features">
        <SectionHeader
          title="Open. Edit. Sign. Done."
          sub="Four everyday tools. Each one does its job and stays out of your way."
        />
        {SHOWCASE_ROWS.map((row, idx) => (
          <div
            key={row.id}
            className={cn(
              "grid divide-y divide-border border-b border-border last:border-b-0 md:grid-cols-2 md:divide-x md:divide-y-0",
              idx % 2 === 1 &&
                "md:divide-x-reverse md:[&>*:first-child]:order-2",
            )}
          >
            <div className="flex flex-col justify-center gap-2.5 p-6 md:p-10">
              <Eyebrow>{row.eyebrow}</Eyebrow>
              <h3 className="text-xl font-medium tracking-tight text-balance text-foreground">
                {row.title}
              </h3>
              <p className="max-w-[44ch] text-sm leading-relaxed text-pretty text-subtle-foreground">
                {row.sub}
              </p>
              <ul
                role="list"
                className="mt-2 flex flex-col gap-2 text-sm text-subtle-foreground"
              >
                {row.points.map((pt) => (
                  <li key={pt} className="flex items-start gap-2.5">
                    <Check className="mt-1 h-3.5 w-3.5 shrink-0 stroke-[2.5] text-brand" />
                    <span>{pt}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex items-center justify-center p-5 md:p-8">
              {row.visual}
            </div>
          </div>
        ))}
      </Framed>

      <Framed id="how-it-works">
        <div className="grid divide-y divide-border md:grid-cols-2 md:divide-x md:divide-y-0">
          <div className="flex flex-col justify-center gap-4 p-6 md:p-12">
            <Eyebrow>How it works</Eyebrow>
            <h2 className="text-3xl font-medium tracking-tighter text-balance text-foreground md:text-4xl">
              Documents shouldn’t feel locked in stone.
            </h2>
            <p className="max-w-[44ch] text-body-md leading-relaxed text-subtle-foreground">
              Most editors bury simple fixes under dozens of menus or force you
              to convert your file and ruin the layout. Open your file, click
              what you want to change, and move on with your day.
            </p>
            <div className="pt-2">
              <SecondaryButton onClick={handleChoose} disabled={uploadDisabled}>
                {isSignedIn ? "Try with a file" : "Sign in to start"}
              </SecondaryButton>
            </div>
          </div>

          <ol className="divide-y divide-border">
            {STEPS.map((s) => (
              <li key={s.num} className="flex items-start gap-5 p-6 md:p-8">
                <span className="pt-0.5 font-mono text-xs font-medium text-brand tabular-nums">
                  {s.num}
                </span>
                <div>
                  <h3 className="text-body-md font-medium text-foreground">
                    {s.title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-subtle-foreground">
                    {s.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </Framed>

      <section
        id="faq"
        className="relative flex w-full scroll-mt-20 flex-col items-center justify-center gap-10 pb-14"
      >
        <SectionHeader
          title="Frequently asked, plainly answered."
          sub="Quick answers before you open your first file."
        />
        <div className="mx-auto grid w-full max-w-3xl gap-2 px-6 md:px-10">
          {faqRows.map(([q, a], idx) => {
            const isOpen = openFaq === idx;
            return (
              <div key={q} className="grid gap-1.5">
                <button
                  type="button"
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  aria-expanded={isOpen}
                  className={cn(
                    "flex w-full cursor-pointer items-center justify-between gap-6 rounded-xl border border-border bg-secondary px-4 py-3.5 text-left text-body-md font-medium text-foreground transition-colors hover:bg-accent",
                    isOpen && "border-input bg-accent",
                  )}
                >
                  <span>{q}</span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
                      isOpen && "rotate-180 text-foreground",
                    )}
                  />
                </button>
                {isOpen && (
                  <div className="rounded-xl border border-border bg-card px-4 py-3.5 text-sm leading-relaxed text-subtle-foreground">
                    {a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section
        id="cta"
        className="flex w-full flex-col items-center justify-center p-4 sm:p-6 md:px-10 md:py-10"
      >
        <div className="relative z-20 flex h-90 w-full flex-col items-center justify-center overflow-hidden rounded-2xl border border-border bg-card px-6 text-center shadow-xl md:h-100">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-cta-glow"
          />
          <h2 className="relative z-10 max-w-md text-3xl font-medium tracking-tighter text-balance text-foreground sm:text-5xl md:max-w-xl md:text-6xl">
            Your file is ready when you are.
          </h2>
          <div className="relative z-10 mt-8 flex flex-col items-center gap-3">
            <PrimaryCtaButton onClick={handleChoose} disabled={uploadDisabled}>
              {isSignedIn ? "Choose a file" : "Sign in to start"}
            </PrimaryCtaButton>
            <span className="text-sm text-muted-foreground">
              Free with Google or GitHub. No download required.
            </span>
          </div>
        </div>
      </section>
    </>
  );
}
