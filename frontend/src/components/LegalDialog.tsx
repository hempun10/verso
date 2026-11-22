import { ShieldCheck } from "lucide-react";
import { BRAND_NAME } from "@/components/BrandLogo";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type LegalTab = "privacy" | "terms";

interface LegalDialogProps {
  open: boolean;
  tab: LegalTab;
  onTabChange: (tab: LegalTab) => void;
  onOpenChange: (open: boolean) => void;
}

export function LegalDialog({
  open,
  tab,
  onTabChange,
  onOpenChange,
}: LegalDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-brand" />
            Legal &amp; Privacy
          </DialogTitle>
          <DialogDescription>
            How {BRAND_NAME} handles your documents, signatures, and account
            data.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={tab}
          onValueChange={(v) => onTabChange(v as LegalTab)}
          className="mt-1"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="privacy">Privacy Policy</TabsTrigger>
            <TabsTrigger value="terms">Terms of Service</TabsTrigger>
          </TabsList>

          <TabsContent
            value="privacy"
            className="mt-3 space-y-3 text-xs leading-relaxed text-muted-foreground"
          >
            <section className="space-y-1">
              <h3 className="text-body-sm font-semibold text-foreground">
                1. Files &amp; Workspace Data
              </h3>
              <p>
                PDFs, images, text edits, signatures, and stamps you upload or
                create are stored privately for your workspace so you can reopen
                and export them. Anonymous browser sessions are isolated per
                browser via an HttpOnly session cookie.
              </p>
            </section>
            <section className="space-y-1">
              <h3 className="text-body-sm font-semibold text-foreground">
                2. Account Information
              </h3>
              <p>
                When you sign in with Google or GitHub, we store only your basic
                profile identifier, display name, and email address to associate
                your folders, files, and saved signatures with your account.
              </p>
            </section>
            <section className="space-y-1">
              <h3 className="text-body-sm font-semibold text-foreground">
                3. Sharing &amp; Deletion
              </h3>
              <p>
                Documents are private by default. Only files where you
                explicitly enable a share link can be accessed by link holders,
                and revoking the link takes effect immediately. You can
                permanently delete any file, folder, signature, or stamp from
                your dashboard at any time.
              </p>
            </section>
            <section className="space-y-1">
              <h3 className="text-body-sm font-semibold text-foreground">
                4. No Ad Tracking or Data Resale
              </h3>
              <p>
                We never sell your data or use the contents of your uploaded
                documents for advertising or third-party model training.
              </p>
            </section>
          </TabsContent>

          <TabsContent
            value="terms"
            className="mt-3 space-y-3 text-xs leading-relaxed text-muted-foreground"
          >
            <section className="space-y-1">
              <h3 className="text-body-sm font-semibold text-foreground">
                1. Acceptable Use
              </h3>
              <p>
                You may use {BRAND_NAME} to edit, sign, stamp, and organize
                documents that you own or have permission to modify. Do not use
                the service for forgery, fraud, or unlawful alteration of
                official records.
              </p>
            </section>
            <section className="space-y-1">
              <h3 className="text-body-sm font-semibold text-foreground">
                2. Ownership of Your Content
              </h3>
              <p>
                You retain full ownership of every file, image, signature, and
                stamp you upload or export. We process your files solely to
                provide editing, OCR, rendering, and storage functionality.
              </p>
            </section>
            <section className="space-y-1">
              <h3 className="text-body-sm font-semibold text-foreground">
                3. Storage &amp; Rate Limits
              </h3>
              <p>
                To keep the service fast and reliable for everyone, uploads are
                subject to per-file size, page count, storage quota, and request
                rate limits.
              </p>
            </section>
            <section className="space-y-1">
              <h3 className="text-body-sm font-semibold text-foreground">
                4. Availability &amp; Liability
              </h3>
              <p>
                The service is provided &ldquo;as is&rdquo;. Always review
                exported files before submitting legal, financial, or official
                paperwork and keep backups of important originals.
              </p>
            </section>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
