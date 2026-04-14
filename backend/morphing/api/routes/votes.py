from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from morphing.api.deps import db_session
from morphing.models import Vote
from morphing.schemas.vote import VoteRead, VoteUpsert
from morphing.services import element_service

router = APIRouter(prefix="/elements", tags=["votes"])


@router.get("/{element_id}/votes", response_model=list[VoteRead])
def list_votes(element_id: str, db: Session = Depends(db_session)) -> list[VoteRead]:
    if not element_service.get_element(db, element_id):
        raise HTTPException(status_code=404, detail="Element not found")
    rows = list(
        db.scalars(select(Vote).where(Vote.element_id == element_id).order_by(Vote.updated_at.desc())).all()
    )
    return [VoteRead.model_validate(r) for r in rows]


@router.put("/{element_id}/votes", response_model=None)
def upsert_vote(element_id: str, payload: VoteUpsert, db: Session = Depends(db_session)) -> VoteRead | Response:
    if not element_service.get_element(db, element_id):
        raise HTTPException(status_code=404, detail="Element not found")
    existing = db.scalars(
        select(Vote).where(Vote.element_id == element_id, Vote.voter_id == payload.voter_id)
    ).first()
    if payload.value == 0:
        if existing:
            db.delete(existing)
            db.commit()
        return Response(status_code=204)
    if existing:
        existing.value = payload.value
        db.commit()
        db.refresh(existing)
        return VoteRead.model_validate(existing)
    v = Vote(element_id=element_id, voter_id=payload.voter_id, value=payload.value)
    db.add(v)
    db.commit()
    db.refresh(v)
    return VoteRead.model_validate(v)
