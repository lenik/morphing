from sqlalchemy.orm import Session

from morphing.models import Element


def shot_to_prompt(db: Session, shot_id: str) -> dict:
    shot = db.get(Element, shot_id)
    if not shot or shot.type_hint != "Shot":
        return {"ok": False}
    prompt = f"Cinematic shot: {shot.title}. {shot.content}".strip()
    md = dict(shot.metadata_ or {})
    md["last_prompt"] = prompt
    md["media"] = {"image": None, "video": None, "provider": "stub"}
    shot.metadata_ = md
    db.commit()
    return {"ok": True, "prompt": prompt, "shot_id": shot_id}


def batch_prompts(db: Session, storyboard_id: str) -> list[dict]:
    from morphing.services import storyboard_service

    shots = storyboard_service.list_shots(db, storyboard_id)
    out: list[dict] = []
    for s in sorted(shots, key=lambda x: (x.metadata_ or {}).get("order", 0)):
        out.append(shot_to_prompt(db, s.id))
    return out
