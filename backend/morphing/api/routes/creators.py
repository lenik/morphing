from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from morphing.api.deps import db_session
from morphing.schemas.element import ElementRead, element_read_from
from morphing.schemas.extra import CreditRequest
from morphing.services import ecosystem_service, element_service

router = APIRouter(prefix="/creators", tags=["creators"])


@router.get("/{author}/elements", response_model=list[ElementRead])
def list_author_elements(author: str, db: Session = Depends(db_session)) -> list[ElementRead]:
    rows = ecosystem_service.list_by_author(db, author)
    return [element_read_from(r) for r in rows]


@router.get("/{author}/score")
def contribution_score(author: str, db: Session = Depends(db_session)) -> dict:
    rows = ecosystem_service.list_by_author(db, author)
    return {"author": author, "element_count": len(rows), "score": len(rows) * 10}


@router.post("/credits/{element_id}")
def add_credit(element_id: str, payload: CreditRequest, db: Session = Depends(db_session)) -> dict:
    if not element_service.get_element(db, element_id):
        raise HTTPException(status_code=404, detail="Element not found")
    ecosystem_service.set_credit(db, element_id, user_id=payload.user_id, role=payload.role)
    return {"ok": True}


@router.get("/lineage/{element_id}")
def fork_lineage(element_id: str, db: Session = Depends(db_session)) -> dict:
    if not element_service.get_element(db, element_id):
        raise HTTPException(status_code=404, detail="Element not found")
    return {"element_id": element_id, "lineage": ecosystem_service.lineage(db, element_id)}


@router.get("/marketplace/list", response_model=list[ElementRead])
def marketplace_list(
    db: Session = Depends(db_session), tag: str = Query("marketplace")
) -> list[ElementRead]:
    rows = element_service.list_elements(db, tag=tag, limit=200)
    return [element_read_from(r) for r in rows]
