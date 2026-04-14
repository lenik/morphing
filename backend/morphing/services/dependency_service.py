from sqlalchemy.orm import Session

from morphing.models import Element
from morphing.services import graph_service


def mark_downstream_outdated(db: Session, root_id: str, *, max_depth: int = 64) -> int:
    """Mark all strict downstream elements with metadata.outdated=true. Returns count updated."""
    nodes, _, _ = graph_service.traverse_downstream(db, root_id, max_depth)
    count = 0
    for nid in nodes:
        if nid == root_id:
            continue
        el = db.get(Element, nid)
        if not el:
            continue
        md = dict(el.metadata_ or {})
        if md.get("outdated") and md.get("outdated_upstream") == root_id:
            continue
        md["outdated"] = True
        md["outdated_upstream"] = root_id
        el.metadata_ = md
        count += 1
    if count:
        db.commit()
    return count


def clear_outdated(db: Session, element_id: str) -> bool:
    el = db.get(Element, element_id)
    if not el:
        return False
    md = dict(el.metadata_ or {})
    md.pop("outdated", None)
    md.pop("outdated_upstream", None)
    el.metadata_ = md
    db.commit()
    return True
