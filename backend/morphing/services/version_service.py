from sqlalchemy import select
from sqlalchemy.orm import Session

from morphing.models import Element, ElementVersionEntry


def _snapshot(el: Element) -> dict:
    return {
        "title": el.title,
        "content": el.content,
        "type_hint": el.type_hint,
        "tags": list(el.tags) if el.tags is not None else [],
        "metadata": dict(el.metadata_) if el.metadata_ is not None else {},
        "author": el.author,
        "version": el.version,
    }


def record_snapshot(db: Session, el: Element) -> None:
    row = ElementVersionEntry(
        element_id=el.id,
        version_number=el.version,
        snapshot=_snapshot(el),
    )
    db.add(row)


def list_versions(db: Session, element_id: str) -> list[ElementVersionEntry]:
    return list(
        db.scalars(
            select(ElementVersionEntry)
            .where(ElementVersionEntry.element_id == element_id)
            .order_by(ElementVersionEntry.version_number.desc())
        ).all()
    )


def revert_to_version(db: Session, element_id: str, version_number: int) -> Element | None:
    el = db.get(Element, element_id)
    if not el:
        return None
    row = db.scalars(
        select(ElementVersionEntry).where(
            ElementVersionEntry.element_id == element_id,
            ElementVersionEntry.version_number == version_number,
        )
    ).first()
    if not row:
        return None
    snap = row.snapshot
    record_snapshot(db, el)
    el.title = snap.get("title", "")
    el.content = snap.get("content", "")
    el.type_hint = snap.get("type_hint", "Idea")
    el.tags = snap.get("tags", [])
    el.metadata_ = snap.get("metadata", {})
    el.author = snap.get("author", "")
    el.version += 1
    db.commit()
    db.refresh(el)
    return el


def fork_element(db: Session, element_id: str, author: str = "") -> Element | None:
    src = db.get(Element, element_id)
    if not src:
        return None
    md = dict(src.metadata_ or {})
    md["fork_of"] = element_id
    lineage = list(md.get("fork_lineage") or [])
    lineage.append(element_id)
    md["fork_lineage"] = lineage
    fork = Element(
        title=(src.title or "Untitled") + " (fork)",
        content=src.content,
        type_hint=src.type_hint,
        tags=list(src.tags) if src.tags else [],
        metadata_=md,
        author=author or src.author,
    )
    db.add(fork)
    db.commit()
    db.refresh(fork)
    return fork
