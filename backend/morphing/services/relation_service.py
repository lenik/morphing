from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from morphing.models import Element, ElementRelation
from morphing.schemas.relation import RelationCreate
from morphing.services.relation_validation import validate_new_relation


def create_relation(
    db: Session,
    data: RelationCreate,
    *,
    forbid_cycles: bool = False,
    strict_relation_type: bool = False,
) -> tuple[ElementRelation | None, str | None]:
    msg = validate_new_relation(
        db,
        parent_id=data.parent_id,
        child_id=data.child_id,
        relation_type=data.relation_type,
        forbid_cycles=forbid_cycles,
        strict_relation_type=strict_relation_type,
    )
    if msg:
        return None, msg
    rel = ElementRelation(
        parent_id=data.parent_id,
        child_id=data.child_id,
        relation_type=data.relation_type,
    )
    db.add(rel)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        return None, "duplicate relation"
    db.refresh(rel)
    return rel, None


def get_relation(db: Session, relation_id: str) -> ElementRelation | None:
    return db.get(ElementRelation, relation_id)


def list_relations_for_element(
    db: Session,
    element_id: str,
    *,
    direction: str = "both",
) -> tuple[list[ElementRelation], list[ElementRelation]]:
    upstream: list[ElementRelation] = []
    downstream: list[ElementRelation] = []
    if direction in ("upstream", "both"):
        upstream = list(
            db.scalars(select(ElementRelation).where(ElementRelation.child_id == element_id)).all()
        )
    if direction in ("downstream", "both"):
        downstream = list(
            db.scalars(select(ElementRelation).where(ElementRelation.parent_id == element_id)).all()
        )
    return upstream, downstream


def delete_relation(db: Session, relation_id: str) -> bool:
    rel = db.get(ElementRelation, relation_id)
    if not rel:
        return False
    db.delete(rel)
    db.commit()
    return True
