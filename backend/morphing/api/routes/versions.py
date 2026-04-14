from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from morphing.api.deps import db_session
from morphing.models import ElementVersionEntry
from morphing.schemas.element import ElementRead, element_read_from
from morphing.services import element_service, version_service

router = APIRouter(prefix="/elements", tags=["versions"])


@router.get("/{element_id}/versions/diff")
def diff_versions(
    element_id: str,
    a: int,
    b: int,
    db: Session = Depends(db_session),
) -> dict:
    if not element_service.get_element(db, element_id):
        raise HTTPException(status_code=404, detail="Element not found")

    def snap(vn: int) -> dict:
        row = db.scalars(
            select(ElementVersionEntry).where(
                ElementVersionEntry.element_id == element_id,
                ElementVersionEntry.version_number == vn,
            )
        ).first()
        return row.snapshot if row else {}

    return {"a": a, "b": b, "snapshot_a": snap(a), "snapshot_b": snap(b)}


@router.get("/{element_id}/versions")
def get_version_history(element_id: str, db: Session = Depends(db_session)) -> list[dict]:
    if not element_service.get_element(db, element_id):
        raise HTTPException(status_code=404, detail="Element not found")
    rows = version_service.list_versions(db, element_id)
    return [
        {
            "id": r.id,
            "element_id": r.element_id,
            "version_number": r.version_number,
            "created_at": r.created_at.isoformat(),
            "snapshot": r.snapshot,
        }
        for r in rows
    ]


@router.post("/{element_id}/revert/{version_number}", response_model=ElementRead)
def revert(element_id: str, version_number: int, db: Session = Depends(db_session)) -> ElementRead:
    el = version_service.revert_to_version(db, element_id, version_number)
    if not el:
        raise HTTPException(status_code=404, detail="Version or element not found")
    return element_read_from(el)


@router.post("/{element_id}/fork", response_model=ElementRead)
def fork(element_id: str, db: Session = Depends(db_session), author: str = "") -> ElementRead:
    el = version_service.fork_element(db, element_id, author=author)
    if not el:
        raise HTTPException(status_code=404, detail="Element not found")
    return element_read_from(el)
