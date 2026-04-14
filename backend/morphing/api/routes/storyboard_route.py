from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from morphing.api.deps import db_session
from morphing.schemas.element import ElementRead, element_read_from
from morphing.schemas.extra import ShotCreateRequest
from morphing.services import storyboard_service

router = APIRouter(prefix="/storyboards", tags=["storyboard"])


@router.post("/from-script/{script_id}", response_model=ElementRead)
def create_from_script(
    script_id: str, db: Session = Depends(db_session), title: str = "", author: str = ""
) -> ElementRead:
    sb = storyboard_service.create_storyboard(db, script_id, title=title, author=author)
    if not sb:
        raise HTTPException(status_code=404, detail="Script not found")
    return element_read_from(sb)


@router.post("/{storyboard_id}/shots", response_model=ElementRead)
def add_shot(
    storyboard_id: str, payload: ShotCreateRequest, db: Session = Depends(db_session)
) -> ElementRead:
    shot = storyboard_service.add_shot(
        db,
        storyboard_id,
        title=payload.title,
        body=payload.body,
        order=payload.order,
    )
    if not shot:
        raise HTTPException(status_code=400, detail="Invalid storyboard")
    return element_read_from(shot)


@router.get("/{storyboard_id}/shots", response_model=list[ElementRead])
def list_shots(storyboard_id: str, db: Session = Depends(db_session)) -> list[ElementRead]:
    shots = storyboard_service.list_shots(db, storyboard_id)
    return [element_read_from(s) for s in shots]
