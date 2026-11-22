"""FastAPI HTTP interface for EditPDF."""

from __future__ import annotations

import os
from pathlib import Path

import httpx
from fastapi import (
    Depends,
    FastAPI,
    File,
    Form,
    Header,
    HTTPException,
    Query,
    Request,
    Response,
    UploadFile,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from editpdf.auth import (
    GUEST_COOKIE_MAX_AGE_SECONDS,
    GUEST_COOKIE_NAME,
    AuthService,
)
from editpdf.config import load_settings
from editpdf.fonts import list_available_override_fonts
from editpdf.models import (
    AssetItem,
    AssetKind,
    AuthConfigResponse,
    CreateAssetRequest,
    CreateFolderRequest,
    DevLoginRequest,
    DevLoginResponse,
    DocumentDetail,
    DocumentListItem,
    DocumentSummary,
    ExportRequest,
    FolderItem,
    MoveDocumentRequest,
    PreviewRequest,
    SaveStateRequest,
    SaveStateResponse,
    ShareRequest,
    ShareResponse,
    StorageUsageResponse,
    TextBlock,
    UpdateFolderRequest,
    UploadLimits,
    UserInfo,
)
from editpdf.security import (
    ALLOWED_IMAGE_MIME_TYPES,
    SlidingWindowRateLimiter,
    TurnstileVerifier,
    detect_image_mime,
    validate_document_upload,
)
from editpdf.service import SessionStore
from editpdf.stamp_engine import StampExtractMode, extract_stamp_mask


def _client_ip(request: Request, *, trust_proxy: bool = False) -> str:
    if trust_proxy:
        cf_ip = request.headers.get("cf-connecting-ip", "").strip()
        if cf_ip:
            return cf_ip
        forwarded = request.headers.get("x-forwarded-for", "")
        if forwarded:
            return forwarded.split(",")[0].strip()
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


def create_app(
    store: SessionStore | None = None,
    rate_limiter: SlidingWindowRateLimiter | None = None,
    captcha_verifier: TurnstileVerifier | None = None,
) -> FastAPI:
    settings = store.settings if store is not None else load_settings()
    settings.validate_for_startup()
    app = FastAPI(title="EditPDF Core API", version="0.4.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.allowed_origins),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=[
            "X-RateLimit-Limit",
            "X-RateLimit-Remaining",
            "Retry-After",
            "X-Stamp-Width",
            "X-Stamp-Height",
        ],
    )

    @app.middleware("http")
    async def security_headers_and_guest_cookie(request: Request, call_next):
        resp = await call_next(request)
        resp.headers.setdefault("X-Content-Type-Options", "nosniff")
        resp.headers.setdefault("X-Frame-Options", "DENY")
        resp.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        resp.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
        if settings.is_production:
            resp.headers.setdefault(
                "Strict-Transport-Security", "max-age=31536000; includeSubDomains"
            )
        new_guest_cookie = getattr(request.state, "new_guest_cookie", None)
        if new_guest_cookie:
            resp.set_cookie(
                key=GUEST_COOKIE_NAME,
                value=new_guest_cookie,
                max_age=GUEST_COOKIE_MAX_AGE_SECONDS,
                httponly=True,
                samesite=settings.cookie_samesite,
                secure=settings.cookie_secure,
                path="/",
            )
        return resp

    sessions = store or SessionStore(settings=settings)
    auth = AuthService(settings=sessions.settings)
    limiter = rate_limiter or SlidingWindowRateLimiter(
        enabled=sessions.settings.rate_limit_enabled
    )
    captcha = captcha_verifier or TurnstileVerifier(
        site_key=sessions.settings.turnstile_site_key,
        secret_key=sessions.settings.turnstile_secret_key,
    )

    @app.exception_handler(httpx.HTTPStatusError)
    async def handle_upstream_error(_request: Request, exc: httpx.HTTPStatusError):
        status = exc.response.status_code
        detail = "Storage backend rejected the request."
        try:
            body = exc.response.json()
            if isinstance(body, dict) and body.get("message"):
                detail = str(body["message"])
        except Exception:
            pass
        mapped = status if status in (400, 401, 403, 404, 413, 429) else 502
        return JSONResponse(status_code=mapped, content={"detail": detail})

    def current_user(
        request: Request,
        authorization: str | None = Header(default=None),
    ) -> UserInfo:
        try:
            guest_cookie = request.cookies.get(GUEST_COOKIE_NAME)
            user, new_cookie = auth.resolve_user(authorization, guest_cookie=guest_cookie)
            if new_cookie:
                request.state.new_guest_cookie = new_cookie
            return user
        except PermissionError as exc:
            raise HTTPException(status_code=401, detail=str(exc)) from exc

    def enforce_rate_limit(
        request: Request,
        response: Response,
        bucket: str,
        user: UserInfo | None,
        *,
        limit: int,
        window_seconds: float = 60.0,
    ) -> None:
        is_signed_in = bool(user and user.provider != "guest" and user.id != "guest")
        subject = (
            user.id
            if (is_signed_in and user is not None)
            else _client_ip(request, trust_proxy=sessions.settings.trust_proxy_headers)
        )
        res = limiter.check(bucket, subject, limit=limit, window_seconds=window_seconds)
        response.headers["X-RateLimit-Limit"] = str(res.limit)
        response.headers["X-RateLimit-Remaining"] = str(res.remaining)
        if not res.allowed:
            raise HTTPException(
                status_code=429,
                detail=f"Too many requests. Please wait {res.retry_after_seconds}s and try again.",
                headers={
                    "Retry-After": str(res.retry_after_seconds),
                    "X-RateLimit-Limit": str(res.limit),
                    "X-RateLimit-Remaining": "0",
                },
            )

    def enforce_captcha(request: Request, captcha_token: str | None) -> None:
        if not captcha.enabled:
            return
        remote_ip = _client_ip(request, trust_proxy=sessions.settings.trust_proxy_headers)
        if not captcha.verify(captcha_token, remote_ip=remote_ip):
            raise HTTPException(
                status_code=403,
                detail="Please complete the security verification (CAPTCHA) and try again.",
            )

    @app.get("/api/health")
    def health():
        return {
            "status": "ok",
            "storage": "appwrite" if sessions.settings.use_appwrite_storage else "local",
            "captcha_enabled": captcha.enabled,
            "rate_limit_enabled": limiter.enabled,
            "override_fonts": list_available_override_fonts(),
        }

    # --- Auth & Public Config ---

    @app.get("/api/auth/config", response_model=AuthConfigResponse)
    def auth_config():
        return AuthConfigResponse(
            mode="appwrite" if sessions.settings.use_appwrite_auth else "local",
            appwrite_endpoint=sessions.settings.appwrite_endpoint,
            appwrite_project_id=sessions.settings.appwrite_project_id,
            oauth_providers=["google", "github"],
            dev_login_enabled=sessions.settings.dev_login_enabled,
            captcha_enabled=captcha.enabled,
            turnstile_site_key=captcha.site_key if captcha.enabled else "",
            limits=UploadLimits(
                max_pdf_bytes=sessions.settings.max_pdf_bytes,
                max_pdf_pages=sessions.settings.max_pdf_pages,
                max_image_bytes=sessions.settings.max_image_bytes,
                allowed_image_types=list(ALLOWED_IMAGE_MIME_TYPES),
            ),
        )

    @app.post("/api/auth/dev-login", response_model=DevLoginResponse)
    def dev_login(
        payload: DevLoginRequest,
        request: Request,
        response: Response,
        x_captcha_token: str | None = Header(default=None),
    ):
        enforce_rate_limit(request, response, "auth", None, limit=12, window_seconds=60.0)
        if not sessions.settings.dev_login_enabled:
            raise HTTPException(status_code=403, detail="Local dev sign-in is disabled.")
        enforce_captcha(request, x_captcha_token)
        token, user = auth.issue_dev_token(payload.email, payload.name)
        return DevLoginResponse(token=token, user=user)

    @app.get("/api/auth/me", response_model=UserInfo)
    def auth_me(user: UserInfo = Depends(current_user)):  # noqa: B008
        return user

    # --- Saved Documents & Sessions ---

    @app.get("/api/documents", response_model=list[DocumentListItem])
    def list_documents(
        request: Request,
        response: Response,
        user: UserInfo = Depends(current_user),  # noqa: B008
    ):
        enforce_rate_limit(request, response, "read", user, limit=120, window_seconds=60.0)
        return sessions.list_documents(user)

    @app.post("/api/documents", response_model=DocumentSummary)
    async def upload_document(
        request: Request,
        response: Response,
        file: UploadFile = File(...),  # noqa: B008
        folder_id: str | None = Form(default=None),  # noqa: B008
        x_captcha_token: str | None = Header(default=None),
        user: UserInfo = Depends(current_user),  # noqa: B008
    ):
        enforce_rate_limit(request, response, "upload", user, limit=15, window_seconds=60.0)
        enforce_captcha(request, x_captcha_token)

        # Read up to max allowed bytes + 1 so oversized uploads fail before buffering huge RAM.
        read_limit = max(sessions.settings.max_pdf_bytes, sessions.settings.max_image_bytes)
        raw = await file.read(read_limit + 1)
        try:
            validate_document_upload(
                raw,
                max_pdf_bytes=sessions.settings.max_pdf_bytes,
                max_image_bytes=sessions.settings.max_image_bytes,
            )
        except OverflowError as exc:
            raise HTTPException(status_code=413, detail=str(exc)) from exc
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        filename = file.filename or "document.pdf"
        try:
            return sessions.create(filename, raw, owner=user, folder_id=folder_id)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Folder not found.") from exc
        except PermissionError as exc:
            raise HTTPException(status_code=403, detail=str(exc)) from exc
        except OverflowError as exc:
            raise HTTPException(status_code=413, detail=str(exc)) from exc
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @app.get("/api/documents/{doc_id}", response_model=DocumentDetail)
    def get_document(
        doc_id: str,
        request: Request,
        response: Response,
        share_token: str | None = Query(default=None),
        user: UserInfo = Depends(current_user),  # noqa: B008
    ):
        enforce_rate_limit(request, response, "read", user, limit=120, window_seconds=60.0)
        try:
            return sessions.get_document_detail(doc_id, user=user, share_token=share_token)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Document not found.") from exc
        except PermissionError as exc:
            raise HTTPException(status_code=403, detail=str(exc)) from exc

    @app.put("/api/documents/{doc_id}/state", response_model=SaveStateResponse)
    def save_document_state(
        doc_id: str,
        payload: SaveStateRequest,
        request: Request,
        response: Response,
        share_token: str | None = Query(default=None),
        user: UserInfo = Depends(current_user),  # noqa: B008
    ):
        enforce_rate_limit(request, response, "write", user, limit=60, window_seconds=60.0)
        try:
            return sessions.save_document_state(
                doc_id,
                user=user,
                edits=payload.edits,
                overlays=payload.overlays,
                share_token=share_token,
            )
        except OverflowError as exc:
            raise HTTPException(status_code=413, detail=str(exc)) from exc
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Document not found.") from exc
        except PermissionError as exc:
            raise HTTPException(status_code=403, detail=str(exc)) from exc

    @app.post("/api/documents/{doc_id}/share", response_model=ShareResponse)
    def share_document(
        doc_id: str,
        payload: ShareRequest,
        request: Request,
        response: Response,
        user: UserInfo = Depends(current_user),  # noqa: B008
    ):
        enforce_rate_limit(request, response, "write", user, limit=30, window_seconds=60.0)
        try:
            return sessions.set_document_share(doc_id, user=user, is_shared=payload.is_shared)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Document not found.") from exc
        except PermissionError as exc:
            raise HTTPException(status_code=403, detail=str(exc)) from exc

    @app.patch("/api/documents/{doc_id}/folder")
    def move_document_folder(
        doc_id: str,
        payload: MoveDocumentRequest,
        request: Request,
        response: Response,
        user: UserInfo = Depends(current_user),  # noqa: B008
    ):
        enforce_rate_limit(request, response, "write", user, limit=60, window_seconds=60.0)
        try:
            sessions.move_document_to_folder(doc_id, user=user, folder_id=payload.folder_id)
            return {"folder_id": payload.folder_id}
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Document or folder not found.") from exc
        except PermissionError as exc:
            raise HTTPException(status_code=403, detail=str(exc)) from exc

    @app.delete("/api/documents/{doc_id}")
    def delete_document(
        doc_id: str,
        request: Request,
        response: Response,
        user: UserInfo = Depends(current_user),  # noqa: B008
    ):
        enforce_rate_limit(request, response, "write", user, limit=30, window_seconds=60.0)
        try:
            sessions.delete_document(doc_id, user=user)
            return {"deleted": True}
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Document not found.") from exc
        except PermissionError as exc:
            raise HTTPException(status_code=403, detail=str(exc)) from exc

    # --- Google Drive–Style Folders ---

    @app.get("/api/folders", response_model=list[FolderItem])
    def list_folders(
        request: Request,
        response: Response,
        user: UserInfo = Depends(current_user),  # noqa: B008
    ):
        enforce_rate_limit(request, response, "read", user, limit=120, window_seconds=60.0)
        return sessions.list_folders(user)

    @app.post("/api/folders", response_model=FolderItem)
    def create_folder(
        payload: CreateFolderRequest,
        request: Request,
        response: Response,
        user: UserInfo = Depends(current_user),  # noqa: B008
    ):
        enforce_rate_limit(request, response, "write", user, limit=30, window_seconds=60.0)
        try:
            return sessions.create_folder(user, payload.name, parent_id=payload.parent_id)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Parent folder not found.") from exc
        except PermissionError as exc:
            raise HTTPException(status_code=403, detail=str(exc)) from exc
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @app.patch("/api/folders/{folder_id}", response_model=FolderItem)
    def update_folder(
        folder_id: str,
        payload: UpdateFolderRequest,
        request: Request,
        response: Response,
        user: UserInfo = Depends(current_user),  # noqa: B008
    ):
        enforce_rate_limit(request, response, "write", user, limit=40, window_seconds=60.0)
        try:
            return sessions.update_folder(
                folder_id,
                user,
                name=payload.name,
                parent_id=payload.parent_id,
                move_parent=payload.move_parent,
            )
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Folder not found.") from exc
        except PermissionError as exc:
            raise HTTPException(status_code=403, detail=str(exc)) from exc
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @app.delete("/api/folders/{folder_id}")
    def delete_folder(
        folder_id: str,
        request: Request,
        response: Response,
        user: UserInfo = Depends(current_user),  # noqa: B008
    ):
        enforce_rate_limit(request, response, "write", user, limit=30, window_seconds=60.0)
        try:
            sessions.delete_folder(folder_id, user)
            return {"deleted": True}
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Folder not found.") from exc
        except PermissionError as exc:
            raise HTTPException(status_code=403, detail=str(exc)) from exc

    @app.get("/api/storage", response_model=StorageUsageResponse)
    def storage_usage(
        request: Request,
        response: Response,
        user: UserInfo = Depends(current_user),  # noqa: B008
    ):
        enforce_rate_limit(request, response, "read", user, limit=120, window_seconds=60.0)
        return sessions.get_storage_usage(user)

    # --- Saved Signatures & Image Library ---

    @app.get("/api/assets", response_model=list[AssetItem])
    def list_assets(
        request: Request,
        response: Response,
        kind: AssetKind | None = Query(default=None),  # noqa: B008
        user: UserInfo = Depends(current_user),  # noqa: B008
    ):
        enforce_rate_limit(request, response, "read", user, limit=120, window_seconds=60.0)
        return sessions.list_assets(user, kind=kind)

    @app.post("/api/assets", response_model=AssetItem)
    def create_asset(
        payload: CreateAssetRequest,
        request: Request,
        response: Response,
        user: UserInfo = Depends(current_user),  # noqa: B008
    ):
        enforce_rate_limit(request, response, "upload", user, limit=25, window_seconds=60.0)
        try:
            return sessions.create_asset(user, payload.kind, payload.name, payload.data_url)
        except OverflowError as exc:
            raise HTTPException(status_code=413, detail=str(exc)) from exc
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @app.get("/api/assets/{asset_id}/content")
    def get_asset_content(
        asset_id: str,
        request: Request,
        response: Response,
        exp: int | None = Query(default=None),
        sig: str | None = Query(default=None),
        authorization: str | None = Header(default=None),
    ):
        user: UserInfo | None = None
        if authorization or request.cookies.get(GUEST_COOKIE_NAME):
            try:
                user, _ = auth.resolve_user(
                    authorization,
                    guest_cookie=request.cookies.get(GUEST_COOKIE_NAME),
                )
            except PermissionError:
                user = None
        enforce_rate_limit(request, response, "read", user, limit=180, window_seconds=60.0)
        try:
            data, mime_type = sessions.get_asset_content(asset_id, user=user, exp=exp, sig=sig)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Asset not found.") from exc
        except PermissionError as exc:
            raise HTTPException(status_code=403, detail=str(exc)) from exc
        return Response(
            content=data,
            media_type=mime_type,
            headers={
                "Cache-Control": "private, max-age=3600",
                "X-Content-Type-Options": "nosniff",
            },
        )

    @app.delete("/api/assets/{asset_id}")
    def delete_asset(
        asset_id: str,
        request: Request,
        response: Response,
        user: UserInfo = Depends(current_user),  # noqa: B008
    ):
        enforce_rate_limit(request, response, "write", user, limit=30, window_seconds=60.0)
        try:
            sessions.delete_asset(asset_id, user=user)
            return {"deleted": True}
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Asset not found.") from exc
        except PermissionError as exc:
            raise HTTPException(status_code=403, detail=str(exc)) from exc

    @app.post("/api/stamps/extract")
    async def extract_stamp(
        request: Request,
        response: Response,
        file: UploadFile = File(...),  # noqa: B008
        mode: StampExtractMode = Query(default="ink"),  # noqa: B008
        sensitivity: int = Query(default=50, ge=0, le=100),  # noqa: B008
        remove_inner_white: bool = Query(default=True),  # noqa: B008
        user: UserInfo = Depends(current_user),  # noqa: B008
    ):
        enforce_rate_limit(request, response, "write", user, limit=45, window_seconds=60.0)
        max_bytes = sessions.settings.max_image_bytes
        raw = await file.read(max_bytes + 1)
        if not raw:
            raise HTTPException(status_code=400, detail="Uploaded image is empty.")
        if len(raw) > max_bytes:
            raise HTTPException(
                status_code=413,
                detail=f"Image exceeds maximum size of {max_bytes // 1_000_000} MB.",
            )
        if not detect_image_mime(raw):
            raise HTTPException(
                status_code=400,
                detail="Only PNG, JPG, and WebP images are supported for stamps.",
            )
        try:
            mask_png, width, height = extract_stamp_mask(
                raw,
                mode=mode,
                sensitivity=sensitivity,
                remove_inner_white=remove_inner_white,
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        return Response(
            content=mask_png,
            media_type="image/png",
            headers={
                "X-Stamp-Width": str(width),
                "X-Stamp-Height": str(height),
            },
        )

    # --- Page Blocks, Preview & Export ---

    @app.get("/api/documents/{doc_id}/pages/{page_index}/blocks", response_model=list[TextBlock])
    def get_page_blocks(
        doc_id: str,
        page_index: int,
        request: Request,
        response: Response,
        share_token: str | None = Query(default=None),
        user: UserInfo = Depends(current_user),  # noqa: B008
    ):
        enforce_rate_limit(request, response, "render", user, limit=90, window_seconds=60.0)
        try:
            return sessions.get_page_blocks(
                doc_id, page_index, user=user, share_token=share_token
            )
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Document not found.") from exc
        except PermissionError as exc:
            raise HTTPException(status_code=403, detail=str(exc)) from exc
        except IndexError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc

    @app.get("/api/documents/{doc_id}/pages/{page_index}/image")
    def get_page_image(
        doc_id: str,
        page_index: int,
        request: Request,
        response: Response,
        dpi: int = Query(default=150, ge=72, le=300),
        share_token: str | None = Query(default=None),
        user: UserInfo = Depends(current_user),  # noqa: B008
    ):
        enforce_rate_limit(request, response, "render", user, limit=90, window_seconds=60.0)
        try:
            png = sessions.render_page_png(
                doc_id,
                page_index,
                edits=None,
                dpi=dpi,
                user=user,
                share_token=share_token,
            )
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Document not found.") from exc
        except PermissionError as exc:
            raise HTTPException(status_code=403, detail=str(exc)) from exc
        except IndexError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        return Response(content=png, media_type="image/png")

    @app.post("/api/documents/{doc_id}/preview")
    def preview_page(
        doc_id: str,
        payload: PreviewRequest,
        request: Request,
        response: Response,
        share_token: str | None = Query(default=None),
        user: UserInfo = Depends(current_user),  # noqa: B008
    ):
        enforce_rate_limit(request, response, "render", user, limit=90, window_seconds=60.0)
        try:
            png = sessions.render_page_png(
                doc_id,
                payload.page_index,
                edits=payload.edits,
                overlays=payload.overlays,
                dpi=payload.dpi,
                user=user,
                share_token=share_token,
            )
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Document not found.") from exc
        except PermissionError as exc:
            raise HTTPException(status_code=403, detail=str(exc)) from exc
        except IndexError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        return Response(content=png, media_type="image/png")

    @app.post("/api/documents/{doc_id}/export")
    def export_document(
        doc_id: str,
        payload: ExportRequest,
        request: Request,
        response: Response,
        share_token: str | None = Query(default=None),
        user: UserInfo = Depends(current_user),  # noqa: B008
    ):
        enforce_rate_limit(request, response, "render", user, limit=30, window_seconds=60.0)
        try:
            record = sessions.get(doc_id, user=user, share_token=share_token)
            pdf_bytes = sessions.export_pdf(
                doc_id,
                payload.edits,
                overlays=payload.overlays,
                user=user,
                share_token=share_token,
            )
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Document not found.") from exc
        except PermissionError as exc:
            raise HTTPException(status_code=403, detail=str(exc)) from exc
        stem = record.filename.rsplit(".", 1)[0]
        headers = {"Content-Disposition": f'attachment; filename="{stem}-edited.pdf"'}
        return Response(content=pdf_bytes, media_type="application/pdf", headers=headers)

    @app.post("/api/documents/{doc_id}/export-image")
    def export_document_image(
        doc_id: str,
        payload: PreviewRequest,
        request: Request,
        response: Response,
        share_token: str | None = Query(default=None),
        user: UserInfo = Depends(current_user),  # noqa: B008
    ):
        enforce_rate_limit(request, response, "render", user, limit=30, window_seconds=60.0)
        try:
            record = sessions.get(doc_id, user=user, share_token=share_token)
            png_bytes = sessions.render_page_png(
                doc_id,
                payload.page_index,
                edits=payload.edits,
                overlays=payload.overlays,
                dpi=payload.dpi,
                user=user,
                share_token=share_token,
            )
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Document not found.") from exc
        except PermissionError as exc:
            raise HTTPException(status_code=403, detail=str(exc)) from exc
        except IndexError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        stem = record.filename.rsplit(".", 1)[0]
        headers = {"Content-Disposition": f'attachment; filename="{stem}-edited.png"'}
        return Response(content=png_bytes, media_type="image/png", headers=headers)

    # Optional built SPA static serving for single-container self-hosting (EDITPDF_STATIC_DIR).
    static_dir_env = os.getenv("EDITPDF_STATIC_DIR", "").strip()
    if static_dir_env:
        static_root = Path(static_dir_env).resolve()
        index_html = static_root / "index.html"
        assets_dir = static_root / "assets"
        if index_html.is_file():
            if assets_dir.is_dir():
                app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="static-assets")

            @app.get("/{full_path:path}", include_in_schema=False)
            def serve_spa(full_path: str):
                if full_path.startswith("api/"):
                    raise HTTPException(status_code=404, detail="Not found.")
                candidate = (static_root / full_path).resolve()
                if (
                    full_path
                    and candidate.is_file()
                    and static_root in candidate.parents
                ):
                    return FileResponse(candidate)
                return FileResponse(index_html)

    return app


app = create_app()
