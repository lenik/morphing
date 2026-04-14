from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from morphing.api.deps import db_session
from morphing.models import Comment
from morphing.schemas.comment import CommentCreate, CommentRead
from morphing.services import element_service

router = APIRouter(prefix="/elements", tags=["comments"])


@router.post("/{element_id}/comments", response_model=CommentRead)
def add_comment(
    element_id: str, payload: CommentCreate, db: Session = Depends(db_session)
) -> CommentRead:
    if not element_service.get_element(db, element_id):
        raise HTTPException(status_code=404, detail="Element not found")
    c = Comment(element_id=element_id, author=payload.author, body=payload.body)
    db.add(c)
    db.commit()
    db.refresh(c)
    return CommentRead.model_validate(c)


@router.get("/{element_id}/comments", response_model=list[CommentRead])
def list_comments(element_id: str, db: Session = Depends(db_session)) -> list[CommentRead]:
    if not element_service.get_element(db, element_id):
        raise HTTPException(status_code=404, detail="Element not found")
    rows = list(
        db.scalars(
            select(Comment).where(Comment.element_id == element_id).order_by(Comment.created_at.asc())
        ).all()
    )
    return [CommentRead.model_validate(r) for r in rows]


@router.delete("/{element_id}/comments/{comment_id}", status_code=204)
def delete_comment(element_id: str, comment_id: str, db: Session = Depends(db_session)) -> None:
    c = db.get(Comment, comment_id)
    if not c or c.element_id != element_id:
        raise HTTPException(status_code=404, detail="Comment not found")
    db.delete(c)
    db.commit()
