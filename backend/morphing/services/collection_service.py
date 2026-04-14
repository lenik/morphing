"""Collection elements: type_hint=Collection, metadata.collection_member_ids: list[str]."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from morphing.models import Element
from morphing.schemas.element import ElementCreate, ElementUpdate
from morphing.services import element_service

MEMBER_KEY = "collection_member_ids"


def _members(md: dict | None) -> list[str]:
    raw = (md or {}).get(MEMBER_KEY)
    if not isinstance(raw, list):
        return []
    out: list[str] = []
    for x in raw:
        if isinstance(x, str) and x.strip():
            out.append(x.strip())
    return out


def list_collections_containing(db: Session, element_id: str) -> list[Element]:
    rows = list(
        db.scalars(select(Element).where(Element.type_hint == "Collection").order_by(Element.updated_at.desc())).all()
    )
    return [r for r in rows if element_id in _members(r.metadata_)]


def create_collection(
    db: Session,
    *,
    title: str,
    member_ids: list[str],
    author: str = "",
) -> Element:
    seen: set[str] = set()
    clean: list[str] = []
    for x in member_ids:
        x = x.strip()
        if not x or x in seen:
            continue
        seen.add(x)
        clean.append(x)
    md = {MEMBER_KEY: clean}
    return element_service.create_element(
        db,
        ElementCreate(
            title=title or "Untitled collection",
            content="",
            type_hint="Collection",
            tags=[],
            metadata=md,
            author=author,
        ),
    )


def patch_members(
    db: Session, collection_id: str, *, add: list[str] | None = None, remove: list[str] | None = None
) -> Element | None:
    el = db.get(Element, collection_id)
    if not el or el.type_hint != "Collection":
        return None
    md = dict(el.metadata_ or {})
    cur = set(_members(md))
    for x in add or []:
        x = x.strip()
        if x:
            cur.add(x)
    for x in remove or []:
        cur.discard(x.strip())
    md[MEMBER_KEY] = sorted(cur)
    return element_service.update_element(db, collection_id, ElementUpdate(metadata=md))
