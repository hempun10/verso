import { type ReactNode, useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Check,
  ChevronDown,
  Eraser,
  FileText,
  ImagePlus,
  LogOut,
  Menu,
  PenTool,
  Share2,
  Upload,
  User as UserIcon,
  X,
} from "lucide-react";
import { BRAND_NAME, BrandLogo } from "@/components/BrandLogo";
import type { LegalTab } from "@/components/LegalDialog";
import { TurnstileWidget } from "@/components/TurnstileWidget";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { formatFileSize } from "@/lib/validation";
import type { UploadLimits, UserInfo } from "@/types";

interface LandingPageProps {
  uploadLimits: UploadLimits;
  captchaRequired: boolean;
  turnstileSiteKey: string;
  uploadCaptchaToken: string | null;
  uploadCaptchaResetKey: number;
  onCaptchaToken: (token: string | null) => void;
  onChooseFile: () => void;
  onUploadFiles: (files: File[]) => void;
  authLoading: boolean;
  isSignedIn: boolean;
  user: UserInfo | null;
  onOpenAuth: () => void;
  onOpenDashboard: () => void;
  onSignOut: () => void;
  onOpenShortcuts: () => void;
  onOpenLegal: (tab: LegalTab) => void;
  error: string | null;
  onDismissError: () => void;
}

/* ------------------------------------------------------ layout primitives */

function PageFrame({ children }: { children: ReactNode }) {
  return (
    <div className="relative mx-auto max-w-7xl md:border-x md:border-[#1f2023]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-0 left-6 z-10 hidden h-full w-px border-l border-[#1f2023] md:block"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-0 right-6 z-10 hidden h-full w-px border-r border-[#1f2023] md:block"
      />
      {children}
    </div>
  );
}

function Stripes({ side }: { side: "left" | "right" }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute top-0 hidden h-full w-14 bg-[size:10px_10px] text-[#f7f8f8]/5 [background-image:repeating-linear-gradient(315deg,currentColor_0_1px,#0000_0_50%)] md:block",
        side === "left" ? "-left-14" : "-right-14",
      )}
    />
  );
}

function Framed({
  id,
  children,
  className,
}: {
  id?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={cn(
        "relative flex w-full scroll-mt-20 flex-col items-center justify-center px-0 md:px-10",
        className,
      )}
    >
      <div className="relative w-full border-x border-[#1f2023] md:mx-10">
        <Stripes side="left" />
        <Stripes side="right" />
        {children}
      </div>
    </section>
  );
}

function Eyebrow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("text-[13px] font-medium text-[#7170ff]", className)}>
      {children}
    </div>
  );
}

function SectionHeader({
  title,
  sub,
  eyebrow,
  className,
}: {
  title: ReactNode;
  sub?: ReactNode;
  eyebrow?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "h-full w-full border-b border-[#1f2023] p-6 md:p-14",
        className,
      )}
    >
      <div className="mx-auto flex max-w-xl flex-col items-center justify-center gap-2 text-center">
        {eyebrow ? <Eyebrow className="mb-1">{eyebrow}</Eyebrow> : null}
        <h2 className="text-3xl font-medium tracking-tighter text-balance text-[#f7f8f8] md:text-4xl">
          {title}
        </h2>
        {sub ? (
          <p className="text-[15px] font-medium text-balance text-[#a1a1aa]">
            {sub}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/** Primary high-contrast white button with inset arrow box. */
function PrimaryCtaButton({
  children,
  onClick,
  disabled,
  size = "lg",
  full = false,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  size?: "sm" | "default" | "lg";
  full?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "group/btn relative inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-lg bg-white text-[13px] font-semibold whitespace-nowrap text-[#08090a] shadow-[inset_0_-1px_0_rgba(0,0,0,0.14),0_1px_2px_rgba(0,0,0,0.4)] transition-[transform,background-color] duration-100 ease-out outline-none hover:bg-[#f4f4f6] focus-visible:ring-2 focus-visible:ring-[#7170ff]/60 active:scale-[0.98] active:bg-[#e8e8ec] disabled:pointer-events-none disabled:opacity-50",
        size === "sm" && "h-[30px] pr-[34px] pl-3 text-xs",
        size === "default" && "h-[34px] pr-[38px] pl-3.5",
        size === "lg" && "h-[38px] pr-[42px] pl-4",
        full && size === "lg" && "w-full pl-[42px]",
        !full && "justify-start",
        className,
      )}
    >
      <span>{children}</span>
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute top-1 right-1 bottom-1 grid place-items-center rounded-md bg-black/[0.08] shadow-[inset_0_1px_1px_rgba(0,0,0,0.12)] transition-colors duration-150 group-hover/btn:bg-black/[0.11]",
          size === "sm" && "w-[22px]",
          size === "default" && "w-[26px]",
          size === "lg" && "w-[30px]",
        )}
      >
        <ArrowRight className="h-3.5 w-3.5 stroke-[2.2]" />
      </span>
    </button>
  );
}

/** Raised dark secondary button. */
function SecondaryButton({
  children,
  onClick,
  disabled,
  size = "lg",
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  size?: "sm" | "default" | "lg";
  className?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#2a2b2f] bg-[#1c1d1f] text-[13px] font-semibold whitespace-nowrap text-[#a1a1aa] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition-[transform,background-color,color] duration-100 ease-out outline-none hover:bg-[#232428] hover:text-[#f7f8f8] focus-visible:ring-2 focus-visible:ring-[#7170ff]/60 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
        size === "sm" && "h-[30px] px-3 text-xs",
        size === "default" && "h-[34px] px-3.5",
        size === "lg" && "h-[38px] px-4",
        className,
      )}
    >
      {children}
    </button>
  );
}

/* --------------------------------------------------------- feature visuals */

function TextEditingVisual() {
  return (
    <div className="flex aspect-[16/10] w-full flex-col justify-between overflow-hidden rounded-xl border border-[#2a2b2f] bg-[#0f1011] p-5">
      <div className="flex items-center justify-between border-b border-[#1f2023] pb-3">
        <div className="flex items-center gap-2 text-xs text-[#a1a1aa]">
          <FileText className="h-3.5 w-3.5 text-[#7170ff]" />
          <span className="font-medium text-[#f7f8f8]">Proposal_2026.pdf</span>
        </div>
        <span className="rounded-full bg-[#3ecf8e]/10 px-2 py-0.5 text-[11px] font-medium text-[#3ecf8e]">
          Saved
        </span>
      </div>

      <div className="my-auto space-y-3 py-2">
        <div className="inline-flex items-center gap-2 rounded-lg border border-[#2a2b2f] bg-[#141516] px-2.5 py-1.5 text-[11px] text-[#a1a1aa] shadow-sm">
          <span className="rounded bg-[#7170ff]/20 px-1.5 py-0.5 font-semibold text-[#f7f8f8]">
            B
          </span>
          <span className="px-1 italic">I</span>
          <span className="px-1 underline">U</span>
          <span className="h-3 w-px bg-[#2a2b2f]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#7170ff]" />
          <span className="text-[11px] text-[#f7f8f8]">12 pt</span>
        </div>

        <div className="rounded-lg border border-[#7170ff] bg-[#7170ff]/10 px-3.5 py-2.5 text-sm text-[#f7f8f8]">
          Total due by December 15:{" "}
          <span className="rounded bg-[#7170ff]/30 px-1 font-semibold">
            $2,450.00
          </span>
          <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-[#7170ff] align-middle" />
        </div>

        <div className="space-y-1.5">
          <div className="h-2 w-5/6 rounded-full bg-[#1c1d1f]" />
          <div className="h-2 w-3/5 rounded-full bg-[#1c1d1f]" />
        </div>
      </div>

      <div className="flex items-center justify-between text-[11px] text-[#62666d]">
        <span>Original layout preserved</span>
        <span className="tabular-nums">Page 1 of 3</span>
      </div>
    </div>
  );
}

function SignatureVisual() {
  return (
    <div className="flex aspect-[16/10] w-full flex-col justify-between overflow-hidden rounded-xl border border-[#2a2b2f] bg-[#0f1011] p-5">
      <div className="flex items-center justify-between border-b border-[#1f2023] pb-3">
        <div className="flex items-center gap-2 text-xs font-medium text-[#f7f8f8]">
          <PenTool className="h-3.5 w-3.5 text-[#7170ff]" />
          <span>Signature library</span>
        </div>
        <span className="rounded-md border border-[#2a2b2f] bg-[#141516] px-2 py-0.5 text-[11px] text-[#a1a1aa]">
          2 saved
        </span>
      </div>

      <div className="my-auto flex flex-col gap-3 py-2">
        <div className="flex items-center justify-center rounded-xl border border-dashed border-[#2a2b2f] bg-[#141516] px-5 py-6">
          <svg
            viewBox="0 0 220 52"
            className="h-11 w-48 text-[#f7f8f8]"
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

        <div className="flex items-center justify-between rounded-lg border border-[#1f2023] bg-[#141516] px-3 py-2 text-xs">
          <span className="text-[#a1a1aa]">Alex Morgan · Primary</span>
          <span className="text-[11px] font-medium text-[#7170ff]">
            Place on page →
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between text-[11px] text-[#62666d]">
        <span>Draw or type once</span>
        <span>Synced to your account</span>
      </div>
    </div>
  );
}

function WhiteoutAndImagesVisual() {
  return (
    <div className="flex aspect-[16/10] w-full flex-col justify-between overflow-hidden rounded-xl border border-[#2a2b2f] bg-[#0f1011] p-5">
      <div className="flex items-center justify-between border-b border-[#1f2023] pb-3">
        <div className="flex items-center gap-2 text-xs font-medium text-[#f7f8f8]">
          <ImagePlus className="h-3.5 w-3.5 text-[#7170ff]" />
          <span>Whiteout &amp; stamps</span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-[#a1a1aa]">
          <span className="rounded border border-[#2a2b2f] bg-[#141516] px-1.5 py-0.5">
            Rotate
          </span>
          <span className="rounded border border-[#2a2b2f] bg-[#141516] px-1.5 py-0.5">
            Crop
          </span>
        </div>
      </div>

      <div className="my-auto grid grid-cols-[1.2fr_0.8fr] items-center gap-3 py-2">
        <div className="space-y-2.5 rounded-xl border border-[#1f2023] bg-[#141516] p-3.5">
          <div className="h-2 w-3/4 rounded-full bg-[#2a2b2f]" />
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-[#7170ff]/70 bg-[#08090a] px-2.5 py-1 text-[11px] text-[#a1a1aa]">
              <Eraser className="h-3 w-3 text-[#7170ff]" />
              <span>Hidden note</span>
            </div>
          </div>
          <div className="h-2 w-5/6 rounded-full bg-[#2a2b2f]" />
          <div className="h-2 w-1/2 rounded-full bg-[#2a2b2f]" />
        </div>

        <div className="flex flex-col items-center justify-center rounded-xl border border-[#3ecf8e]/30 bg-[#3ecf8e]/10 p-4 text-center -rotate-3">
          <span className="text-[11px] font-semibold tracking-widest text-[#3ecf8e] uppercase">
            Approved
          </span>
          <span className="mt-0.5 text-[10px] text-[#3ecf8e]/80">
            Custom stamp
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between text-[11px] text-[#62666d]">
        <span>PNG, JPG &amp; WebP ready</span>
        <span>Drag to resize or tilt</span>
      </div>
    </div>
  );
}

function SharingVisual() {
  return (
    <div className="flex aspect-[16/10] w-full flex-col justify-between overflow-hidden rounded-xl border border-[#2a2b2f] bg-[#0f1011] p-5">
      <div className="flex items-center justify-between border-b border-[#1f2023] pb-3">
        <div className="flex items-center gap-2 text-xs font-medium text-[#f7f8f8]">
          <Share2 className="h-3.5 w-3.5 text-[#7170ff]" />
          <span>Drive folders &amp; sharing</span>
        </div>
        <span className="inline-flex items-center gap-1 text-[11px] text-[#3ecf8e]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#3ecf8e]" />
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
            className="flex items-center justify-between rounded-lg border border-[#1f2023] bg-[#141516] px-3 py-2 text-xs"
          >
            <div className="flex min-w-0 items-center gap-2">
              <FileText className="h-3.5 w-3.5 shrink-0 text-[#62666d]" />
              <span className="truncate font-medium text-[#f7f8f8]">
                {row.name}
              </span>
            </div>
            <span className="shrink-0 text-[11px] text-[#8a8f98] tabular-nums">
              {row.meta}
            </span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between text-[11px] text-[#62666d]">
        <span>Organize in folders</span>
        <span>Shareable edit links</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- copy */

const SHOWCASE_ROWS = [
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

const STEPS = [
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

const WORKS_ON = [
  "PDFs",
  "Screenshots",
  "Scanned forms",
  "Receipts",
  "Contracts",
];

/* -------------------------------------------------------------------- main */

export function LandingPage({
  uploadLimits,
  captchaRequired,
  turnstileSiteKey,
  uploadCaptchaToken,
  uploadCaptchaResetKey,
  onCaptchaToken,
  onChooseFile,
  onUploadFiles,
  authLoading,
  isSignedIn,
  user,
  onOpenAuth,
  onOpenDashboard,
  onSignOut,
  onOpenShortcuts,
  onOpenLegal,
  error,
  onDismissError,
}: LandingPageProps) {
  const [scrolled, setScrolled] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const navLinks = [
    { href: "#features", label: "Features" },
    { href: "#how-it-works", label: "How it works" },
    { href: "#faq", label: "FAQ" },
  ];

  const faqRows: [string, string][] = [
    [
      "Do I need an account to edit a file?",
      "No. You can drop a PDF or image, edit text, add a signature, and download your finished file right away. Sign up anytime to keep your folders, files, and signatures synced in your dashboard.",
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
    <div className="landing-shell isolate min-h-svh w-full bg-[#08090a] text-[#f7f8f8] antialiased">
      <PageFrame>
        {/* Floating header — clean nav + Sign up / Open dashboard */}
        <header
          className={cn(
            "sticky z-50 mx-3 flex justify-center transition-all duration-300 md:mx-0",
            scrolled ? "top-4" : "top-3",
          )}
        >
          <div
            className={cn(
              "w-full transition-all duration-300",
              scrolled ? "max-w-[820px]" : "max-w-7xl",
            )}
          >
            <div
              className={cn(
                "mx-auto rounded-2xl transition-all duration-300",
                scrolled
                  ? "border border-[#1f2023] bg-[#08090a]/80 px-2 backdrop-blur-lg"
                  : "px-4 md:px-10",
              )}
            >
              <div className="flex h-[56px] items-center justify-between px-2">
                {/* Brand */}
                <a
                  href="#hero"
                  className="flex items-center gap-2.5 text-[15px] font-semibold tracking-[-0.01em] text-[#f7f8f8]"
                >
                  <BrandLogo size={24} />
                  <span>{BRAND_NAME}</span>
                </a>

                {/* Quiet sentence-case center nav */}
                <nav className="hidden items-center gap-1 md:flex">
                  {navLinks.map((n) => (
                    <a
                      key={n.label}
                      href={n.href}
                      className="rounded-full px-3 py-1.5 text-[14px] text-[#a1a1aa] transition-colors hover:bg-[#1c1d1f]/70 hover:text-[#f7f8f8]"
                    >
                      {n.label}
                    </a>
                  ))}
                </nav>

                {/* Right: Sign up (guest) OR Open dashboard (signed in) */}
                <div className="flex items-center gap-2.5">
                  {authLoading ? (
                    <div
                      data-auth-skeleton="true"
                      className="h-[30px] w-28 animate-pulse rounded-lg bg-[#1c1d1f]"
                    />
                  ) : isSignedIn && user ? (
                    <>
                      <SecondaryButton
                        size="sm"
                        onClick={onOpenDashboard}
                        className="hidden sm:inline-flex"
                      >
                        Open dashboard
                      </SecondaryButton>
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            aria-label="Account menu"
                            className="inline-flex h-[30px] w-[30px] cursor-pointer items-center justify-center rounded-lg border border-[#2a2b2f] bg-[#141516] text-[11px] font-semibold text-[#f7f8f8] transition-colors hover:bg-[#1c1d1f]"
                          >
                            {(user.name || user.email)
                              .slice(0, 1)
                              .toUpperCase()}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent
                          align="end"
                          className="w-56 border-[#2a2b2f] bg-[#141516] p-3 text-[#f7f8f8]"
                        >
                          <div className="space-y-0.5">
                            <div className="text-xs font-semibold text-[#f7f8f8]">
                              {user.name}
                            </div>
                            <div className="truncate text-[11px] text-[#8a8f98]">
                              {user.email}
                            </div>
                          </div>
                          <Separator className="my-2.5 bg-[#1f2023]" />
                          <div className="flex flex-col gap-1">
                            <button
                              type="button"
                              onClick={onOpenDashboard}
                              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-[#a1a1aa] transition-colors hover:bg-[#1c1d1f] hover:text-[#f7f8f8]"
                            >
                              <FileText className="h-3.5 w-3.5" />
                              Open dashboard
                            </button>
                            <button
                              type="button"
                              onClick={onOpenAuth}
                              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-[#a1a1aa] transition-colors hover:bg-[#1c1d1f] hover:text-[#f7f8f8]"
                            >
                              <UserIcon className="h-3.5 w-3.5" />
                              Switch account
                            </button>
                            <button
                              type="button"
                              onClick={onSignOut}
                              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-[#e0705f] transition-colors hover:bg-[#e0705f]/10"
                            >
                              <LogOut className="h-3.5 w-3.5" />
                              Sign out
                            </button>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </>
                  ) : (
                    <SecondaryButton
                      size="sm"
                      onClick={onOpenAuth}
                      className="hidden sm:inline-flex"
                    >
                      Sign up
                    </SecondaryButton>
                  )}

                  <button
                    type="button"
                    onClick={() => setDrawerOpen((o) => !o)}
                    aria-label="Menu"
                    className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-[#1f2023] text-[#f7f8f8] md:hidden"
                  >
                    {drawerOpen ? (
                      <X className="h-4 w-4" />
                    ) : (
                      <Menu className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Mobile bottom sheet drawer */}
          {drawerOpen && (
            <>
              <div
                className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs md:hidden"
                onClick={() => setDrawerOpen(false)}
              />
              <div className="fixed inset-x-3 bottom-3 z-50 rounded-xl border border-[#1f2023] bg-[#0f1011] p-4 shadow-2xl md:hidden">
                <div className="flex items-center justify-between pb-3">
                  <span className="flex items-center gap-2 text-sm font-semibold text-[#f7f8f8]">
                    <BrandLogo size={24} />
                    {BRAND_NAME}
                  </span>
                  <button
                    type="button"
                    onClick={() => setDrawerOpen(false)}
                    className="rounded-md border border-[#1f2023] p-1 text-[#a1a1aa]"
                    aria-label="Close menu"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <ul className="mb-3 flex flex-col divide-y divide-[#1f2023] rounded-lg border border-[#1f2023] text-sm">
                  {navLinks.map((n) => (
                    <li key={n.label}>
                      <a
                        href={n.href}
                        onClick={() => setDrawerOpen(false)}
                        className="block px-3 py-2.5 text-[#a1a1aa] hover:text-[#f7f8f8]"
                      >
                        {n.label}
                      </a>
                    </li>
                  ))}
                </ul>
                {isSignedIn ? (
                  <PrimaryCtaButton
                    full
                    onClick={() => {
                      setDrawerOpen(false);
                      onOpenDashboard();
                    }}
                  >
                    Open dashboard
                  </PrimaryCtaButton>
                ) : (
                  <PrimaryCtaButton
                    full
                    onClick={() => {
                      setDrawerOpen(false);
                      onOpenAuth();
                    }}
                  >
                    Sign up
                  </PrimaryCtaButton>
                )}
              </div>
            </>
          )}
        </header>

        {/* Inline Error Banner (validation, rate-limit, etc.) */}
        {error && (
          <div className="relative z-30 mx-auto max-w-3xl px-6 pt-4">
            <div
              role="alert"
              className="flex items-center justify-between gap-3 rounded-xl border border-[#e0705f]/35 bg-[#e0705f]/12 px-4 py-2.5 text-xs text-[#f7d8d2]"
            >
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-[#e0705f]" />
                <span>{error}</span>
              </div>
              <button
                type="button"
                aria-label="Dismiss error"
                onClick={onDismissError}
                className="cursor-pointer rounded p-1 text-[#f7d8d2]/80 hover:bg-[#e0705f]/20 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        <main className="flex w-full flex-col items-center justify-center divide-y divide-[#1f2023]">
          {/* --------------------------------------------------------- HERO */}
          <section id="hero" className="relative w-full">
            <div className="relative flex w-full flex-col items-center px-6">
              {/* Subtle horizon indigo wash */}
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
                    contracts, hide private details, and place logos — then
                    download cleanly.
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

                  {/* Quiet works-on row */}
                  <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[13px] text-[#8a8f98]">
                    <span className="text-xs font-medium text-[#62666d]">
                      Made for
                    </span>
                    {WORKS_ON.map((item) => (
                      <span
                        key={item}
                        className="inline-flex items-center gap-1.5"
                      >
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
                  Or click to browse from your computer. Click any text to edit
                  it in place, sign, and export as PDF or PNG.
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
                  <PrimaryCtaButton
                    disabled={captchaRequired && !uploadCaptchaToken}
                  >
                    Choose PDF or image
                  </PrimaryCtaButton>
                </div>

                <p className="mt-4 text-[12px] text-[#62666d] tabular-nums">
                  PDF up to {formatFileSize(uploadLimits.max_pdf_bytes)} · PNG,
                  JPG, WebP up to {formatFileSize(uploadLimits.max_image_bytes)}{" "}
                  · No signup needed
                </p>
              </div>
            </div>

            <div className="h-12 md:h-16" />
          </section>

          {/* ------------------------------------ ALTERNATING FEATURES GRID */}
          <Framed id="features">
            <SectionHeader
              title="Open. Edit. Sign. Done."
              sub="Four everyday tools. Each one does its job and stays out of your way."
            />
            {SHOWCASE_ROWS.map((row, idx) => (
              <div
                key={row.id}
                className={cn(
                  "grid divide-y divide-[#1f2023] border-b border-[#1f2023] last:border-b-0 md:grid-cols-2 md:divide-x md:divide-y-0",
                  idx % 2 === 1 &&
                    "md:divide-x-reverse md:[&>*:first-child]:order-2",
                )}
              >
                <div className="flex flex-col justify-center gap-2.5 p-6 md:p-10">
                  <Eyebrow>{row.eyebrow}</Eyebrow>
                  <h3 className="text-xl font-medium tracking-tight text-balance text-[#f7f8f8]">
                    {row.title}
                  </h3>
                  <p className="max-w-[44ch] text-[14px] leading-relaxed text-pretty text-[#a1a1aa]">
                    {row.sub}
                  </p>
                  <ul
                    role="list"
                    className="mt-2 flex flex-col gap-2 text-[14px] text-[#a1a1aa]"
                  >
                    {row.points.map((pt) => (
                      <li key={pt} className="flex items-start gap-2.5">
                        <Check className="mt-1 h-3.5 w-3.5 shrink-0 stroke-[2.5] text-[#7170ff]" />
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

          {/* ------------------------------------------- HOW IT WORKS LOOP */}
          <Framed id="how-it-works">
            <div className="grid divide-y divide-[#1f2023] md:grid-cols-2 md:divide-x md:divide-y-0">
              <div className="flex flex-col justify-center gap-4 p-6 md:p-12">
                <Eyebrow>How it works</Eyebrow>
                <h2 className="text-3xl font-medium tracking-tighter text-balance text-[#f7f8f8] md:text-4xl">
                  Documents shouldn’t feel locked in stone.
                </h2>
                <p className="max-w-[44ch] text-[15px] leading-relaxed text-[#a1a1aa]">
                  Most editors bury simple fixes under dozens of menus or force
                  you to convert your file and ruin the layout. Open your file,
                  click what you want to change, and move on with your day.
                </p>
                <div className="pt-2">
                  <SecondaryButton
                    onClick={onChooseFile}
                    disabled={captchaRequired && !uploadCaptchaToken}
                  >
                    Try with a file
                  </SecondaryButton>
                </div>
              </div>

              <ol className="divide-y divide-[#1f2023]">
                {STEPS.map((s) => (
                  <li
                    key={s.num}
                    className="flex items-start gap-5 p-6 md:p-8"
                  >
                    <span className="pt-0.5 font-mono text-xs font-medium text-[#7170ff] tabular-nums">
                      {s.num}
                    </span>
                    <div>
                      <h3 className="text-[15px] font-medium text-[#f7f8f8]">
                        {s.title}
                      </h3>
                      <p className="mt-1.5 text-[14px] leading-relaxed text-[#a1a1aa]">
                        {s.body}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </Framed>

          {/* ---------------------------------------------------------- FAQ */}
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
                        "flex w-full cursor-pointer items-center justify-between gap-6 rounded-xl border border-[#1f2023] bg-[#141516] px-4 py-3.5 text-left text-[15px] font-medium text-[#f7f8f8] transition-colors hover:bg-[#1c1d1f]",
                        isOpen && "border-[#2a2b2f] bg-[#1c1d1f]",
                      )}
                    >
                      <span>{q}</span>
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 shrink-0 text-[#8a8f98] transition-transform duration-200",
                          isOpen && "rotate-180 text-[#f7f8f8]",
                        )}
                      />
                    </button>
                    {isOpen && (
                      <div className="rounded-xl border border-[#1f2023] bg-[#0f1011] px-4 py-3.5 text-[14px] leading-relaxed text-[#a1a1aa]">
                        {a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* ------------------------------------------------------ CLOSING */}
          <section
            id="cta"
            className="flex w-full flex-col items-center justify-center p-4 sm:p-6 md:px-10 md:py-10"
          >
            <div className="relative z-20 flex h-[360px] w-full flex-col items-center justify-center overflow-hidden rounded-2xl border border-[#1f2023] bg-[#0f1011] px-6 text-center shadow-xl md:h-[400px]">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 [background:radial-gradient(60%_80%_at_50%_0%,rgba(113,112,255,0.28),transparent_70%)]"
              />
              <h2 className="relative z-10 max-w-md text-3xl font-medium tracking-tighter text-balance text-[#f7f8f8] sm:text-5xl md:max-w-xl md:text-6xl">
                Your file is ready when you are.
              </h2>
              <div className="relative z-10 mt-8 flex flex-col items-center gap-3">
                <PrimaryCtaButton
                  onClick={onChooseFile}
                  disabled={captchaRequired && !uploadCaptchaToken}
                >
                  Choose a file
                </PrimaryCtaButton>
                <span className="text-sm text-[#8a8f98]">
                  Free to try. No download required.
                </span>
              </div>
            </div>
          </section>

          {/* ------------------------------------------------------- FOOTER */}
          <footer id="footer" className="w-full pb-0">
            <div className="flex flex-col gap-10 p-6 md:flex-row md:items-start md:justify-between md:p-12">
              <div className="flex max-w-xs flex-col items-start gap-4">
                <a
                  href="#hero"
                  className="flex items-center gap-2.5 text-lg font-semibold text-[#f7f8f8]"
                >
                  <BrandLogo size={28} />
                  <span>{BRAND_NAME}</span>
                </a>
                <p className="text-[14px] leading-relaxed text-[#8a8f98]">
                  Edit text, sign forms, hide private details, and share
                  documents right in your browser.
                </p>
                <p className="text-xs text-[#62666d]">
                  © {new Date().getFullYear()} {BRAND_NAME}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-10 sm:grid-cols-3 md:pr-6">
                <ul role="list" className="flex flex-col gap-2.5">
                  <li className="text-xs font-semibold text-[#f7f8f8]">
                    Product
                  </li>
                  <li>
                    <a
                      href="#features"
                      className="text-sm text-[#8a8f98] transition-colors hover:text-[#f7f8f8]"
                    >
                      Features
                    </a>
                  </li>
                  <li>
                    <a
                      href="#how-it-works"
                      className="text-sm text-[#8a8f98] transition-colors hover:text-[#f7f8f8]"
                    >
                      How it works
                    </a>
                  </li>
                  <li>
                    <a
                      href="#faq"
                      className="text-sm text-[#8a8f98] transition-colors hover:text-[#f7f8f8]"
                    >
                      FAQ
                    </a>
                  </li>
                </ul>

                <ul role="list" className="flex flex-col gap-2.5">
                  <li className="text-xs font-semibold text-[#f7f8f8]">
                    Workspace
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={onOpenDashboard}
                      className="cursor-pointer text-left text-sm text-[#8a8f98] transition-colors hover:text-[#f7f8f8]"
                    >
                      Open dashboard
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={onChooseFile}
                      className="cursor-pointer text-left text-sm text-[#8a8f98] transition-colors hover:text-[#f7f8f8]"
                    >
                      Upload file
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={onOpenShortcuts}
                      className="cursor-pointer text-left text-sm text-[#8a8f98] transition-colors hover:text-[#f7f8f8]"
                    >
                      Shortcuts
                    </button>
                  </li>
                </ul>

                <ul role="list" className="flex flex-col gap-2.5">
                  <li className="text-xs font-semibold text-[#f7f8f8]">
                    Account
                  </li>
                  <li>
                    {isSignedIn && user ? (
                      <span className="text-sm text-[#8a8f98]">
                        {user.name}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={onOpenAuth}
                        className="cursor-pointer text-left text-sm text-[#8a8f98] transition-colors hover:text-[#f7f8f8]"
                      >
                        Sign up
                      </button>
                    )}
                  </li>
                  {isSignedIn && (
                    <li>
                      <button
                        type="button"
                        onClick={onSignOut}
                        className="cursor-pointer text-left text-sm text-[#8a8f98] transition-colors hover:text-[#f7f8f8]"
                      >
                        Sign out
                      </button>
                    </li>
                  )}
                  <li>
                    <button
                      type="button"
                      onClick={() => onOpenLegal("privacy")}
                      className="cursor-pointer text-left text-sm text-[#8a8f98] transition-colors hover:text-[#f7f8f8]"
                    >
                      Privacy Policy
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => onOpenLegal("terms")}
                      className="cursor-pointer text-left text-sm text-[#8a8f98] transition-colors hover:text-[#f7f8f8]"
                    >
                      Terms of Service
                    </button>
                  </li>
                </ul>
              </div>
            </div>

            {/* Faded dot-matrix footer band */}
            <div className="relative z-0 mt-8 h-32 w-full md:h-44">
              <div className="absolute inset-0 z-10 bg-gradient-to-t from-transparent from-40% to-[#08090a]" />
              <div
                aria-hidden="true"
                className="absolute inset-0 mx-6 bg-[size:14px_14px] text-[#f7f8f8]/10 [background-image:radial-gradient(currentColor_1px,transparent_1px)]"
              />
            </div>
          </footer>
        </main>
      </PageFrame>
    </div>
  );
}
