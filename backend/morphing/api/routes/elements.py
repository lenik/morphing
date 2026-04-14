from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session

from morphing.api.deps import db_session
from morphing.config import settings
from morphing.schemas.element import ElementCreate, ElementRead, ElementUpdate, element_read_from
from morphing.services import element_service
from morphing.services.icon_service import write_element_icon_files

router = APIRouter(prefix="/elements", tags=["elements"])


@router.post("", response_model=ElementRead)
def create_element(payload: ElementCreate, db: Session = Depends(db_session)) -> ElementRead:
    el = element_service.create_element(db, payload)
    return element_read_from(el)


@router.get("", response_model=list[ElementRead])
def list_elements(
    db: Session = Depends(db_session),
    type_hint: str | None = None,
    tag: str | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
) -> list[ElementRead]:
    rows = element_service.list_elements(db, type_hint=type_hint, tag=tag, skip=skip, limit=limit)
    return [element_read_from(r) for r in rows]


@router.get("/{element_id}", response_model=ElementRead)
def get_element(element_id: str, db: Session = Depends(db_session)) -> ElementRead:
    el = element_service.get_element(db, element_id)
    if not el:
        raise HTTPException(status_code=404, detail="Element not found")
    return element_read_from(el)


@router.patch("/{element_id}", response_model=ElementRead)
def update_element(
    element_id: str, payload: ElementUpdate, db: Session = Depends(db_session)
) -> ElementRead:
    el = element_service.update_element(db, element_id, payload)
    if not el:
        raise HTTPException(status_code=404, detail="Element not found")
    return element_read_from(el)


@router.delete("/{element_id}", status_code=204)
def delete_element(element_id: str, db: Session = Depends(db_session)) -> None:
    if not element_service.delete_element(db, element_id):
        raise HTTPException(status_code=404, detail="Element not found")


@router.post("/{element_id}/icon", response_model=ElementRead)
async def upload_element_icon(
    element_id: str,
    db: Session = Depends(db_session),
    file: UploadFile = File(...),
) -> ElementRead:
    el = element_service.get_element(db, element_id)
    if not el:
        raise HTTPException(status_code=404, detail="Element not found")
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty file")
    media_root: Path = settings.media_root.resolve()
    media_root.mkdir(parents=True, exist_ok=True)
    try:
        rel_full, rel_thumb = write_element_icon_files(media_root, element_id, data)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
    prefix = f"{settings.api_prefix}/media"
    md = dict(el.metadata_ or {})
    md["icon_url"] = f"{prefix}/{rel_full}"
    md["icon_thumb_url"] = f"{prefix}/{rel_thumb}"
    updated = element_service.update_element(db, element_id, ElementUpdate(metadata=md))
    if not updated:
        raise HTTPException(status_code=404, detail="Element not found")
    return element_read_from(updated)
