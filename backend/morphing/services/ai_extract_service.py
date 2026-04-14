"""Heuristic / stub extraction — replace with LLM pipeline later."""

import re
from typing import Any

from sqlalchemy.orm import Session

from morphing.models import Element


def extract_slots(db: Session, element_id: str, text_override: str | None = None) -> dict[str, Any]:
    el = db.get(Element, element_id)
    if not el:
        return {}
    text = text_override if text_override is not None else el.content or ""
    slots: dict[str, Any] = {"source_element_id": element_id, "raw_len": len(text)}
    if el.type_hint == "Character":
        slots["traits"] = _bullet_lines(text)
        slots["role"] = _first_sentence(text)
    elif el.type_hint == "Scene":
        slots["location"] = _first_sentence(text)
        slots["beats"] = _bullet_lines(text)
    elif el.type_hint == "Story":
        slots["conflict"] = _detect_conflict(text)
        slots["beats"] = _bullet_lines(text)
    else:
        slots["keywords"] = re.findall(r"[\w\-]{4,}", text.lower())[:40]
    md = dict(el.metadata_ or {})
    md["ai_slots"] = slots
    el.metadata_ = md
    db.commit()
    db.refresh(el)
    return slots


def _first_sentence(text: str) -> str:
    m = re.split(r"[。\.\n]", text.strip(), maxsplit=1)
    return (m[0] if m else "").strip()[:500]


def _bullet_lines(text: str) -> list[str]:
    lines = [ln.strip("- *•\t ") for ln in text.splitlines()]
    return [ln for ln in lines if ln][:32]


def _detect_conflict(text: str) -> str:
    for kw in ("矛盾", "冲突", "versus", "against", "but"):
        if kw.lower() in text.lower():
            return kw
    return "unspecified"
