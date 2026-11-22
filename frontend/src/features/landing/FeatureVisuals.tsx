import { Eraser, FileText, ImagePlus, PenTool, Share2 } from "lucide-react";

function TextEditingVisual() {
  return (
    <div className="flex aspect-[16/10] w-full flex-col justify-between overflow-hidden rounded-xl border border-input bg-card p-5">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2 text-xs text-subtle-foreground">
          <FileText className="h-3.5 w-3.5 text-brand" />
          <span className="font-medium text-foreground">Proposal_2026.pdf</span>
        </div>
        <span className="rounded-full bg-success/10 px-2 py-0.5 text-label font-medium text-success">
          Saved
        </span>
      </div>

      <div className="my-auto space-y-3 py-2">
        <div className="inline-flex items-center gap-2 rounded-lg border border-input bg-secondary px-2.5 py-1.5 text-label text-subtle-foreground shadow-sm">
          <span className="rounded bg-brand/20 px-1.5 py-0.5 font-semibold text-foreground">
            B
          </span>
          <span className="px-1 italic">I</span>
          <span className="px-1 underline">U</span>
          <span className="h-3 w-px bg-input" />
          <span className="h-2.5 w-2.5 rounded-full bg-brand" />
          <span className="text-label text-foreground">12 pt</span>
        </div>

        <div className="rounded-lg border border-brand bg-brand/10 px-3.5 py-2.5 text-sm text-foreground">
          Total due by December 15:{" "}
          <span className="rounded bg-brand/30 px-1 font-semibold">
            $2,450.00
          </span>
          <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-brand align-middle" />
        </div>

        <div className="space-y-1.5">
          <div className="h-2 w-5/6 rounded-full bg-accent" />
          <div className="h-2 w-3/5 rounded-full bg-accent" />
        </div>
      </div>

      <div className="flex items-center justify-between text-label text-dim-foreground">
        <span>Original layout preserved</span>
        <span className="tabular-nums">Page 1 of 3</span>
      </div>
    </div>
  );
}

function SignatureVisual() {
  return (
    <div className="flex aspect-[16/10] w-full flex-col justify-between overflow-hidden rounded-xl border border-input bg-card p-5">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2 text-xs font-medium text-foreground">
          <PenTool className="h-3.5 w-3.5 text-brand" />
          <span>Signature library</span>
        </div>
        <span className="rounded-md border border-input bg-secondary px-2 py-0.5 text-label text-subtle-foreground">
          2 saved
        </span>
      </div>

      <div className="my-auto flex flex-col gap-3 py-2">
        <div className="flex items-center justify-center rounded-xl border border-dashed border-input bg-secondary px-5 py-6">
          <svg
            viewBox="0 0 220 52"
            className="h-11 w-48 text-foreground"
            fill="none"
          >
            <path
              d="M10 38C22 14 36 8 42 22C46 32 30 40 48 34C64 28 76 12 86 18C94 23 80 39 98 34C116 29 130 15 140 24C148 31 162 30 176 24C190 19 202 22 212 18"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border bg-secondary px-3 py-2 text-xs">
          <span className="text-subtle-foreground">Alex Morgan · Primary</span>
          <span className="text-label font-medium text-brand">
            Place on page →
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between text-label text-dim-foreground">
        <span>Draw or type once</span>
        <span>Synced to your account</span>
      </div>
    </div>
  );
}

function WhiteoutAndImagesVisual() {
  return (
    <div className="flex aspect-[16/10] w-full flex-col justify-between overflow-hidden rounded-xl border border-input bg-card p-5">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2 text-xs font-medium text-foreground">
          <ImagePlus className="h-3.5 w-3.5 text-brand" />
          <span>Whiteout &amp; stamps</span>
        </div>
        <div className="flex items-center gap-1.5 text-label text-subtle-foreground">
          <span className="rounded border border-input bg-secondary px-1.5 py-0.5">
            Rotate
          </span>
          <span className="rounded border border-input bg-secondary px-1.5 py-0.5">
            Crop
          </span>
        </div>
      </div>

      <div className="my-auto grid grid-cols-[1.2fr_0.8fr] items-center gap-3 py-2">
        <div className="space-y-2.5 rounded-xl border border-border bg-secondary p-3.5">
          <div className="h-2 w-3/4 rounded-full bg-input" />
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-brand/70 bg-background px-2.5 py-1 text-label text-subtle-foreground">
              <Eraser className="h-3 w-3 text-brand" />
              <span>Hidden note</span>
            </div>
          </div>
          <div className="h-2 w-5/6 rounded-full bg-input" />
          <div className="h-2 w-1/2 rounded-full bg-input" />
        </div>

        <div className="flex -rotate-3 flex-col items-center justify-center rounded-xl border border-success/30 bg-success/10 p-4 text-center">
          <span className="text-label font-semibold tracking-widest text-success uppercase">
            Approved
          </span>
          <span className="mt-0.5 text-2xs text-success/80">
            Custom stamp
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between text-label text-dim-foreground">
        <span>PNG, JPG &amp; WebP ready</span>
        <span>Drag to resize or tilt</span>
      </div>
    </div>
  );
}

function SharingVisual() {
  return (
    <div className="flex aspect-[16/10] w-full flex-col justify-between overflow-hidden rounded-xl border border-input bg-card p-5">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2 text-xs font-medium text-foreground">
          <Share2 className="h-3.5 w-3.5 text-brand" />
          <span>Drive folders &amp; sharing</span>
        </div>
        <span className="inline-flex items-center gap-1 text-label text-success">
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
          Synced
        </span>
      </div>

      <div className="my-auto space-y-2.5 py-2">
        {[
          { name: "Contracts / Lease_Agreement.pdf", meta: "4 edits · 2m ago" },
          { name: "Invoices / Q4_Invoice_Final.pdf", meta: "Signed · 1h ago" },
          { name: "HR / Onboarding_Form.pdf", meta: "2 edits · Yesterday" },
        ].map((row) => (
          <div
            key={row.name}
            className="flex items-center justify-between rounded-lg border border-border bg-secondary px-3 py-2 text-xs"
          >
            <div className="flex min-w-0 items-center gap-2">
              <FileText className="h-3.5 w-3.5 shrink-0 text-dim-foreground" />
              <span className="truncate font-medium text-foreground">
                {row.name}
              </span>
            </div>
            <span className="shrink-0 text-label text-muted-foreground tabular-nums">
              {row.meta}
            </span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between text-label text-dim-foreground">
        <span>Organize in folders</span>
        <span>Shareable edit links</span>
      </div>
    </div>
  );
}

export const SHOWCASE_ROWS = [
  {
    id: "text",
    eyebrow: "Text",
    title: "Click any word and just type.",
    sub: "Fix a typo, update a date, or highlight a line without breaking the rest of the page. What you see on screen is what downloads.",
    points: [
      "Edit single words or whole lines right on the page",
      "Bold, italic, color, and highlight only the text you select",
      "Works on regular PDFs and scanned pages alike",
    ],
    visual: <TextEditingVisual />,
  },
  {
    id: "signatures",
    eyebrow: "Signatures",
    title: "Sign once, reuse anytime.",
    sub: "Draw your signature or pick a clean handwritten style. Save it to your library so the next contract takes two seconds.",
    points: [
      "Draw smoothly with a trackpad, mouse, or stylus",
      "Type a clean script signature if you prefer",
      "Resize, rotate, and place on any page",
    ],
    visual: <SignatureVisual />,
  },
  {
    id: "whiteout",
    eyebrow: "Whiteout & images",
    title: "Hide what shouldn’t be there. Add what should.",
    sub: "Cover old numbers or private notes cleanly, then drop in a company logo, stamp, or photo right where it belongs.",
    points: [
      "Drag a clean whiteout patch over any part of the page",
      "Upload PNG, JPG, or WebP images and reuse saved stamps",
      "Resize, rotate, crop, and adjust transparency on the canvas",
    ],
    visual: <WhiteoutAndImagesVisual />,
  },
  {
    id: "sharing",
    eyebrow: "Dashboard",
    title: "Organize every file like Google Drive.",
    sub: "Create folders, upload PDFs or images right into them, move files around, and pick up where you left off from your dashboard.",
    points: [
      "Group contracts, invoices, and forms into nested folders",
      "Every change auto-saves in the background",
      "Share one link so teammates can review and edit too",
    ],
    visual: <SharingVisual />,
  },
];

export const STEPS = [
  {
    num: "01",
    title: "Drop your file",
    body: "Choose any PDF or image from your computer — invoices, resumes, screenshots, or scanned forms. Oversized or invalid files are caught before uploading.",
  },
  {
    num: "02",
    title: "Edit right on the page",
    body: "Click text to change it, draw or drop a saved signature, white out old details, or place a logo. Undo and redo anytime.",
  },
  {
    num: "03",
    title: "Organize, download, or share",
    body: "Export a crisp PDF or PNG immediately, sort it into folders in your dashboard, or share a link so a client can finish signing.",
  },
];

export const WORKS_ON = [
  "PDFs",
  "Screenshots",
  "Scanned forms",
  "Receipts",
  "Contracts",
];
