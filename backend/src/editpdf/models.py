"""Core schemas shared across PDF analysis, preview, and export."""

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, Field

PageKind = Literal["native", "scanned"]
FontSource = Literal["embedded", "system", "builtin", "override"]


class TextStyle(BaseModel):
    font_family: str
    original_font_name: str
    font_source: FontSource = "builtin"
    font_size_pt: float
    color_hex: str
    bold: bool = False
    italic: bool = False
    serif: bool = False
    mono: bool = False
    confidence: float = Field(default=1.0, ge=0.0, le=1.0)


class TextBlock(BaseModel):
    id: str
    page_index: int
    kind: PageKind
    text: str
    # PDF points, top-left origin: [x0, y0, x1, y1]
    bbox: tuple[float, float, float, float]
    origin: tuple[float, float]
    angle_deg: float = 0.0
    style: TextStyle
    font_xref: int | None = None


class PageInfo(BaseModel):
    page_index: int
    kind: PageKind
    width_pt: float
    height_pt: float


class DocumentSummary(BaseModel):
    doc_id: str
    filename: str
    page_count: int
    pages: list[PageInfo]


class TextRun(BaseModel):
    text: str
    font_family_override: str | None = None
    font_size_pt_override: float | None = Field(default=None, gt=0.0, le=500.0)
    color_hex_override: str | None = None
    bold_override: bool | None = None
    italic_override: bool | None = None
    underline: bool = False
    strikethrough: bool = False
    highlight_hex: str | None = None


class TextEdit(BaseModel):
    block_id: str
    new_text: str
    font_family_override: str | None = None
    font_size_pt_override: float | None = Field(default=None, gt=0.0, le=500.0)
    color_hex_override: str | None = None
    bold_override: bool | None = None
    italic_override: bool | None = None
    underline: bool = False
    strikethrough: bool = False
    highlight_hex: str | None = None
    runs: list[TextRun] | None = None


class WhiteoutOverlay(BaseModel):
    id: str
    kind: Literal["whiteout"] = "whiteout"
    page_index: int = Field(ge=0)
    # PDF points, top-left origin: [x0, y0, x1, y1]
    bbox: tuple[float, float, float, float]
    fill_hex: str = "#ffffff"
    shape: Literal["rect", "ellipse"] = "rect"


class ImageOverlay(BaseModel):
    id: str
    kind: Literal["image"] = "image"
    page_index: int = Field(ge=0)
    # PDF points, top-left origin: [x0, y0, x1, y1]
    bbox: tuple[float, float, float, float]
    asset_id: str | None = None
    asset_url: str | None = None
    data_url: str | None = None
    opacity: float = Field(default=1.0, ge=0.05, le=1.0)
    angle_deg: float = Field(default=0.0, ge=-180.0, le=180.0)
    # Optional normalized source crop box [left, top, right, bottom] in [0..1]
    crop: tuple[float, float, float, float] | None = None


PageOverlay = Annotated[WhiteoutOverlay | ImageOverlay, Field(discriminator="kind")]


class UserInfo(BaseModel):
    id: str
    email: str
    name: str
    provider: Literal["google", "github", "appwrite", "dev", "guest"] = "dev"


class UploadLimits(BaseModel):
    max_pdf_bytes: int
    max_pdf_pages: int
    max_image_bytes: int
    allowed_image_types: list[str]


class AuthConfigResponse(BaseModel):
    mode: Literal["appwrite", "local"]
    appwrite_endpoint: str
    appwrite_project_id: str
    oauth_providers: list[str]
    dev_login_enabled: bool
    captcha_enabled: bool = False
    turnstile_site_key: str = ""
    limits: UploadLimits


class DevLoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=200)
    name: str = Field(default="", max_length=120)


class DevLoginResponse(BaseModel):
    token: str
    user: UserInfo


AssetKind = Literal["signature", "image"]


class AssetItem(BaseModel):
    asset_id: str
    kind: AssetKind
    name: str
    mime_type: str
    width: int
    height: int
    created_at: float
    url: str


class CreateAssetRequest(BaseModel):
    kind: AssetKind
    name: str = Field(default="Untitled", max_length=120)
    data_url: str


class StorageUsageResponse(BaseModel):
    used_bytes: int
    quota_bytes: int
    document_count: int
    asset_count: int


class FolderItem(BaseModel):
    folder_id: str
    name: str
    parent_id: str | None = None
    created_at: float
    updated_at: float


class CreateFolderRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    parent_id: str | None = None


class UpdateFolderRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    parent_id: str | None = None
    move_parent: bool = False


class MoveDocumentRequest(BaseModel):
    folder_id: str | None = None


class DocumentListItem(BaseModel):
    doc_id: str
    filename: str
    page_count: int
    edit_count: int
    overlay_count: int
    folder_id: str | None = None
    is_shared: bool
    share_token: str | None = None
    version: int
    updated_at: float
    updated_by: str


class DocumentDetail(DocumentSummary):
    owner_id: str
    is_owner: bool
    folder_id: str | None = None
    is_shared: bool
    share_token: str | None = None
    edits: list[TextEdit] = Field(default_factory=list)
    overlays: list[PageOverlay] = Field(default_factory=list)
    version: int = 1
    updated_at: float = 0.0
    updated_by: str = ""


class SaveStateRequest(BaseModel):
    edits: list[TextEdit] = Field(default_factory=list)
    overlays: list[PageOverlay] = Field(default_factory=list)


class SaveStateResponse(BaseModel):
    version: int
    updated_at: float
    updated_by: str


class ShareRequest(BaseModel):
    is_shared: bool


class ShareResponse(BaseModel):
    is_shared: bool
    share_token: str | None = None


class PreviewRequest(BaseModel):
    page_index: int = Field(ge=0)
    edits: list[TextEdit] = Field(default_factory=list)
    overlays: list[PageOverlay] = Field(default_factory=list)
    dpi: int = Field(default=150, ge=72, le=300)


class ExportRequest(BaseModel):
    edits: list[TextEdit] = Field(default_factory=list)
    overlays: list[PageOverlay] = Field(default_factory=list)
