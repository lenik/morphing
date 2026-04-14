"""Element icon files: original + thumbnail on disk. Caller updates element metadata."""

from __future__ import annotations

import io
import uuid
from pathlib import Path


THUMB_MAX = 64


def _ensure_dir(p: Path) -> None:
    p.mkdir(parents=True, exist_ok=True)


def write_element_icon_files(media_root: Path, element_id: str, data: bytes) -> tuple[str, str]:
    """
    Write PNG original and WEBP thumbnail under media_root/elements/{id}/.
    Returns URL paths relative to the mounted media prefix, e.g.
    /api/media/elements/{id}/icon-xxx.png
    """
    try:
        from PIL import Image
    except ImportError as e:
        raise RuntimeError("Pillow is required for icon upload") from e

    base = media_root / "elements" / element_id
    _ensure_dir(base)
    uid = uuid.uuid4().hex[:12]
    raw_name = f"icon-{uid}.png"
    thumb_name = f"icon-{uid}-thumb.png"
    raw_path = base / raw_name
    thumb_path = base / thumb_name

    img = Image.open(io.BytesIO(data)).convert("RGBA")
    img.save(raw_path, format="PNG")

    thumb = img.copy()
    thumb.thumbnail((THUMB_MAX, THUMB_MAX), Image.Resampling.LANCZOS)
    thumb.save(thumb_path, format="PNG")

    rel = f"elements/{element_id}"
    return f"{rel}/{raw_name}", f"{rel}/{thumb_name}"
