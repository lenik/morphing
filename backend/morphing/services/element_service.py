from sqlalchemy import select, text
from sqlalchemy.orm import Session

from morphing.config import settings
from morphing.models import Element
from morphing.schemas.element import ElementCreate, ElementUpdate
from morphing.services import dependency_service, version_service


def _bump_version(el: Element) -> None:
    el.version += 1


def create_element(db: Session, data: ElementCreate) -> Element:
    el = Element(
        title=data.title,
        content=data.content,
        type_hint=data.type_hint,
        tags=data.tags,
        metadata_=data.metadata,
        author=data.author,
    )
    db.add(el)
    db.commit()
    db.refresh(el)
    return el


def get_element(db: Session, element_id: str) -> Element | None:
    return db.get(Element, element_id)


def list_elements(
    db: Session,
    *,
    type_hint: str | None = None,
    tag: str | None = None,
    skip: int = 0,
    limit: int = 100,
) -> list[Element]:
    q = select(Element).order_by(Element.updated_at.desc())
    if type_hint:
        q = q.where(Element.type_hint == type_hint)
    if tag:
        if settings.database_url.startswith("sqlite"):
            q = q.where(
                text(
                    "EXISTS (SELECT 1 FROM json_each(coalesce(elements.tags, '[]')) AS j "
                    "WHERE j.value = :tag_filter)"
                )
            ).params(tag_filter=tag)
        else:
            q = q.where(Element.tags.contains([tag]))
    q = q.offset(skip).limit(min(limit, 500))
    return list(db.scalars(q).all())


def update_element(db: Session, element_id: str, data: ElementUpdate) -> Element | None:
    el = db.get(Element, element_id)
    if not el:
        return None
    version_service.record_snapshot(db, el)
    for field, value in data.model_dump(exclude_unset=True).items():
        if field == "metadata":
            setattr(el, "metadata_", value)
        else:
            setattr(el, field, value)
    _bump_version(el)
    db.commit()
    db.refresh(el)
    dependency_service.mark_downstream_outdated(db, element_id)
    db.refresh(el)
    return el


def delete_element(db: Session, element_id: str) -> bool:
    el = db.get(Element, element_id)
    if not el:
        return False
    db.delete(el)
    db.commit()
    return True
