import { Keyboard } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";

interface ShortcutRow {
  label: string;
  keys: string[];
}

const SECTIONS: { title: string; items: ShortcutRow[] }[] = [
  {
    title: "Dashboard & Drive",
    items: [
      { label: "Create new folder", keys: ["N"] },
      { label: "Upload file to current folder", keys: ["U"] },
      { label: "Search files & folders", keys: ["⌘K", "/"] },
      { label: "Toggle Grid / List view", keys: ["G"] },
      { label: "Go up one folder", keys: ["⌫"] },
      { label: "Context menu (New folder / Upload)", keys: ["Right-click"] },
    ],
  },
  {
    title: "Editor Tools",
    items: [
      { label: "Select & edit text", keys: ["V"] },
      { label: "Whiteout draw tool", keys: ["W"] },
      { label: "Open Signature Pad", keys: ["G"] },
      { label: "Insert Image / Watermark", keys: ["I"] },
    ],
  },
  {
    title: "Text Formatting",
    items: [
      { label: "Bold", keys: ["⌘", "B"] },
      { label: "Italic", keys: ["⌘", "I"] },
      { label: "Underline", keys: ["⌘", "U"] },
      { label: "Strikethrough", keys: ["⇧", "⌘", "X"] },
      { label: "Commit / Cancel text edit", keys: ["↵", "Esc"] },
    ],
  },
  {
    title: "Selected Image / Whiteout",
    items: [
      { label: "Crop selected image", keys: ["C"] },
      { label: "Rotate +15° / -15°", keys: ["R", "⇧R"] },
      { label: "Nudge 1pt / 10pt", keys: ["↑↓←→", "⇧"] },
      { label: "Duplicate overlay", keys: ["⌘", "D"] },
      { label: "Delete overlay", keys: ["⌫"] },
    ],
  },
  {
    title: "Document & View",
    items: [
      { label: "Undo / Redo", keys: ["⌘Z", "⇧⌘Z"] },
      { label: "Save session", keys: ["⌘", "S"] },
      { label: "Export edited file", keys: ["⌘", "E"] },
      { label: "Toggle text boxes", keys: ["B"] },
      { label: "Zoom in / out / reset", keys: ["+", "-", "0"] },
      { label: "Previous / Next page", keys: ["[", "]"] },
      { label: "Show shortcuts", keys: ["?"] },
    ],
  },
];

interface ShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShortcutsDialog({ open, onOpenChange }: ShortcutsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-4 w-4" />
            Keyboard Shortcuts
          </DialogTitle>
          <DialogDescription>
            Speed up editing, formatting, and positioning across your documents
            (use Ctrl instead of ⌘ on Windows/Linux).
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {SECTIONS.map((sec) => (
            <div key={sec.title} className="space-y-2">
              <div className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                {sec.title}
              </div>
              <div className="space-y-1.5 rounded-xl border bg-muted/30 p-3">
                {sec.items.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between gap-2 text-xs"
                  >
                    <span className="text-foreground/90">{item.label}</span>
                    <span className="flex shrink-0 items-center gap-1">
                      {item.keys.map((k) => (
                        <Kbd key={k}>{k}</Kbd>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
