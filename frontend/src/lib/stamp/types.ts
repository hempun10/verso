export type StampExtractMode = "ink" | "engraved" | "cutout";
export type StampTemplate = "circle" | "oval" | "rect" | "raw";
export type StampBorderStyle = "classic" | "dotted" | "notary";

export interface StampConfig {
  template: StampTemplate;
  borderStyle: StampBorderStyle;
  inkColor: string;
  topText: string;
  bottomText: string;
  showStars: boolean;
  showDate: boolean;
  logoScale: number; // 0.35..1.25
  distress: number; // 0..100
  seed: number;
}

export const STAMP_INK_PRESETS = [
  { hex: "#1b3f8b", label: "Official Blue" },
  { hex: "#b91c1c", label: "Crimson Red" },
  { hex: "#4c1d95", label: "Stamp Violet" },
  { hex: "#18181b", label: "Archival Black" },
  { hex: "#166534", label: "Verified Green" },
] as const;

export function formatStampDate(date = new Date()): string {
  const day = String(date.getDate()).padStart(2, "0");
  const months = [
    "JAN",
    "FEB",
    "MAR",
    "APR",
    "MAY",
    "JUN",
    "JUL",
    "AUG",
    "SEP",
    "OCT",
    "NOV",
    "DEC",
  ];
  return `${day} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

export function getStampCanvasSize(template: StampTemplate): {
  width: number;
  height: number;
} {
  switch (template) {
    case "oval":
      return { width: 1024, height: 680 };
    case "rect":
      return { width: 1024, height: 520 };
    case "circle":
    case "raw":
    default:
      return { width: 1024, height: 1024 };
  }
}
