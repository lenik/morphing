from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from morphing.api.deps import db_session
from morphing.schemas.extra import MorphPreviewRequest
from morphing.services import element_service, morph_service

router = APIRouter(prefix="/morph", tags=["morph"])


@router.post("/preview/{element_id}")
def preview(element_id: str, payload: MorphPreviewRequest, db: Session = Depends(db_session)) -> dict:
    if not element_service.get_element(db, element_id):
        raise HTTPException(status_code=404, detail="Element not found")
    return morph_service.preview_morph(db, element_id, change_note=payload.change_note)


@router.post("/approve/{element_id}")
def approve(element_id: str, db: Session = Depends(db_session)) -> dict:
    ok = morph_service.approve_morph_stub(db, element_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Element not found")
    return {"ok": True}
