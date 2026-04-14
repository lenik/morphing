from sqlalchemy.orm import Session

from morphing.models import Element


def preview_morph(db: Session, root_element_id: str, change_note: str = "") -> dict:
    """Stub morph: returns rewritten placeholders for downstream narrative layers."""
    el = db.get(Element, root_element_id)
    if not el:
        return {"ok": False, "error": "not found"}
    return {
        "ok": True,
        "root_id": root_element_id,
        "change_note": change_note,
        "proposed": {
            "story": f"[morph] {el.title}: {change_note or 'rewrite'}",
            "script": "[morph] script body placeholder",
            "storyboard": "[morph] shot list placeholder",
        },
        "approval_required": True,
    }


def approve_morph_stub(db: Session, root_element_id: str) -> bool:
    el = db.get(Element, root_element_id)
    if not el:
        return False
    md = dict(el.metadata_ or {})
    md["morph_approved_at"] = True
    el.metadata_ = md
    db.commit()
    return True
