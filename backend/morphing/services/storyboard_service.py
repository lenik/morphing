from sqlalchemy import select
from sqlalchemy.orm import Session

from morphing.models import Element, ElementRelation
from morphing.schemas.element import ElementCreate
from morphing.services import element_service


def create_storyboard(db: Session, script_id: str, title: str, author: str = "") -> Element | None:
    script = db.get(Element, script_id)
    if not script:
        return None
    sb = element_service.create_element(
        db,
        ElementCreate(
            title=title or f"Storyboard — {script.title}",
            content="",
            type_hint="Storyboard",
            tags=["storyboard"],
            metadata={"script_id": script_id, "shot_order": []},
            author=author or script.author,
        ),
    )
    db.add(
        ElementRelation(parent_id=script.id, child_id=sb.id, relation_type="script_to_storyboard")
    )
    db.commit()
    db.refresh(sb)
    return sb


def add_shot(
    db: Session,
    storyboard_id: str,
    *,
    title: str,
    body: str,
    order: int | None = None,
) -> Element | None:
    sb = db.get(Element, storyboard_id)
    if not sb or sb.type_hint != "Storyboard":
        return None
    md = dict(sb.metadata_ or {})
    order_list: list[str] = list(md.get("shot_order") or [])
    shot = element_service.create_element(
        db,
        ElementCreate(
            title=title,
            content=body,
            type_hint="Shot",
            tags=["shot"],
            metadata={
                "storyboard_id": storyboard_id,
                "order": order if order is not None else len(order_list),
            },
            author=sb.author,
        ),
    )
    order_list.append(shot.id)
    md["shot_order"] = order_list
    sb.metadata_ = md
    db.add(ElementRelation(parent_id=sb.id, child_id=shot.id, relation_type="storyboard_to_shot"))
    db.commit()
    db.refresh(shot)
    db.refresh(sb)
    return shot


def list_shots(db: Session, storyboard_id: str) -> list[Element]:
    rels = list(
        db.scalars(
            select(ElementRelation).where(
                ElementRelation.parent_id == storyboard_id,
                ElementRelation.relation_type == "storyboard_to_shot",
            )
        ).all()
    )
    child_ids = [r.child_id for r in rels]
    shots = [db.get(Element, cid) for cid in child_ids]
    return [s for s in shots if s is not None]
