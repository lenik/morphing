from sqlalchemy import select
from sqlalchemy.orm import Session

from morphing.graph_schema import RELATION_TYPES_DEFAULT
from morphing.models import Element, ElementRelation


def _outgoing(db: Session, parent_id: str) -> list[ElementRelation]:
    return list(db.scalars(select(ElementRelation).where(ElementRelation.parent_id == parent_id)).all())


def can_reach(db: Session, start_id: str, end_id: str) -> bool:
    """Follow parent->child edges from start_id; True if end_id is reachable."""
    stack = [start_id]
    seen: set[str] = set()
    while stack:
        n = stack.pop()
        if n == end_id:
            return True
        if n in seen:
            continue
        seen.add(n)
        for r in _outgoing(db, n):
            stack.append(r.child_id)
    return False


def validate_new_relation(
    db: Session,
    *,
    parent_id: str,
    child_id: str,
    relation_type: str,
    forbid_cycles: bool = False,
    strict_relation_type: bool = False,
) -> str | None:
    if parent_id == child_id:
        return "parent and child must differ"
    if not relation_type or len(relation_type) > 64:
        return "invalid relation_type"
    if strict_relation_type and relation_type not in RELATION_TYPES_DEFAULT:
        return f"relation_type must be one of {sorted(RELATION_TYPES_DEFAULT)}"
    p = db.get(Element, parent_id)
    c = db.get(Element, child_id)
    if not p or not c:
        return "parent or child element not found"
    if forbid_cycles and can_reach(db, child_id, parent_id):
        return "would create a directed cycle"
    return None


def relation_exists(db: Session, parent_id: str, child_id: str, relation_type: str) -> bool:
    r = db.scalars(
        select(ElementRelation).where(
            ElementRelation.parent_id == parent_id,
            ElementRelation.child_id == child_id,
            ElementRelation.relation_type == relation_type,
        )
    ).first()
    return r is not None
