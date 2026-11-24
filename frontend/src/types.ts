export type PageKind = "native" | "scanned";
export type FontSource = "embedded" | "system" | "builtin" | "override";

export interface TextStyle {
  font_family: string;
  original_font_name: string;
  font_source: FontSource;
  font_size_pt: number;
  color_hex: string;
  bold: boolean;
  italic: boolean;
  serif: boolean;
  mono: boolean;
  confidence: number;
}

export interface TextBlock {
  id: string;
  page_index: number;
  kind: PageKind;
  text: string;
  bbox: [number, number, number, number];
  origin: [number, number];
  angle_deg: number;
  style: TextStyle;
  font_xref: number | null;
}

export interface PageInfo {
  page_index: number;
  kind: PageKind;
  width_pt: number;
  height_pt: number;
}

export interface DocumentSummary {
  doc_id: string;
  filename: string;
  page_count: number;
  pages: PageInfo[];
}

export interface TextRunStyle {
  font_family_override?: string | null;
  font_size_pt_override?: number | null;
  color_hex_override?: string | null;
  bold_override?: boolean | null;
  italic_override?: boolean | null;
  underline?: boolean;
  strikethrough?: boolean;
  highlight_hex?: string | null;
}

export interface TextRun extends TextRunStyle {
  text: string;
}

export interface TextEdit extends TextRunStyle {
  block_id: string;
  new_text: string;
  runs?: TextRun[] | null;
  source_block?: TextBlock | null;
}

export type WhiteoutShape = "rect" | "ellipse";

export interface WhiteoutOverlay {
  id: string;
  kind: "whiteout";
  page_index: number;
  bbox: [number, number, number, number];
  fill_hex: string;
  shape: WhiteoutShape;
}

export interface ImageOverlay {
  id: string;
  kind: "image";
  page_index: number;
  bbox: [number, number, number, number];
  asset_id?: string | null;
  asset_url?: string | null;
  data_url?: string | null;
  opacity: number;
  angle_deg: number;
  crop?: [number, number, number, number] | null;
}

export type PageOverlay = WhiteoutOverlay | ImageOverlay;
export type ToolMode = "select" | "whiteout";

export interface UserInfo {
  id: string;
  email: string;
  name: string;
  provider: "google" | "github" | "appwrite" | "dev" | "guest";
}

export interface UploadLimits {
  max_pdf_bytes: number;
  max_pdf_pages: number;
  max_image_bytes: number;
  allowed_image_types: string[];
}

export interface AuthConfig {
  mode: "appwrite" | "local";
  appwrite_endpoint: string;
  appwrite_project_id: string;
  oauth_providers: string[];
  dev_login_enabled: boolean;
  captcha_enabled: boolean;
  turnstile_site_key: string;
  limits?: UploadLimits;
}

export type AssetKind = "signature" | "image";

export interface AssetItem {
  asset_id: string;
  kind: AssetKind;
  name: string;
  mime_type: string;
  width: number;
  height: number;
  created_at: number;
  url: string;
}

export interface StorageUsage {
  used_bytes: number;
  quota_bytes: number;
  document_count: number;
  asset_count: number;
}

export interface FolderItem {
  folder_id: string;
  name: string;
  parent_id: string | null;
  created_at: number;
  updated_at: number;
}

export interface DocumentListItem {
  doc_id: string;
  filename: string;
  page_count: number;
  edit_count: number;
  overlay_count: number;
  folder_id?: string | null;
  is_shared: boolean;
  share_token?: string | null;
  version: number;
  updated_at: number;
  updated_by: string;
}

export interface DocumentDetail extends DocumentSummary {
  owner_id: string;
  is_owner: boolean;
  folder_id?: string | null;
  is_shared: boolean;
  share_token?: string | null;
  edits: TextEdit[];
  overlays: PageOverlay[];
  version: number;
  updated_at: number;
  updated_by: string;
}

export interface SaveStateResponse {
  version: number;
  updated_at: number;
  updated_by: string;
}

export interface ShareResponse {
  is_shared: boolean;
  share_token?: string | null;
}
