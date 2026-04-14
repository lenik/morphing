from sqlalchemy import select
from sqlalchemy.orm import Session

from morphing.models import Element


def set_credit(db: Session, element_id: str, user_id: str, role: str) -> bool:
    el = db.get(Element, element_id)
    if not el:
        return False
    md = dict(el.metadata_ or {})
    credits = list(md.get("credits") or [])
    credits.append({"user_id": user_id, "role": role})
    md["credits"] = credits
    el.metadata_ = md
    db.commit()
    return True


def list_by_author(db: Session, author: str) -> list[Element]:
    return list(db.scalars(select(Element).where(Element.author == author)).all())


def lineage(db: Session, element_id: str) -> list[str]:
    el = db.get(Element, element_id)
    if not el:
        return []
    md = el.metadata_ or {}
    return list(md.get("fork_lineage") or []) + ([md["fork_of"]] if md.get("fork_of") else [])
