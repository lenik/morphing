from __future__ import annotations

import json
from typing import Any

import httpx
from sqlalchemy.orm import Session

from morphing.config import settings
from morphing.models import Element, ElementRelation
from morphing.schemas.element import ElementCreate, ElementUpdate
from morphing.services import element_service, relation_service
from morphing.schemas.relation import RelationCreate


def _chunk_paragraphs(text: str, size: int = 3, max_chunks: int = 5) -> list[str]:
    parts = [p.strip() for p in text.split("\n") if p.strip()]
    if not parts:
        return []
    chunks: list[str] = []
    for i in range(0, len(parts), size):
        chunks.append("\n".join(parts[i : i + size]))
        if len(chunks) >= max_chunks:
            break
    return chunks


def _heuristic_analyze_story(story_text: str, title: str) -> dict[str, Any]:
    lines = [ln.strip(" -\t") for ln in story_text.splitlines() if ln.strip()]
    characters: list[dict[str, str]] = []
    scenes: list[dict[str, str]] = []
    actions: list[str] = []
    for ln in lines:
        low = ln.lower()
        if any(k in low for k in ("character", "人物", "主角", "姓名", "name:")) and len(characters) < 8:
            characters.append({"name": ln[:48], "description": ln[:280], "personality": "", "age": ""})
        elif any(k in low for k in ("scene", "场景", "地点", "location", "time")) and len(scenes) < 8:
            scenes.append({"title": ln[:64], "description": ln[:320]})
        else:
            if len(actions) < 16:
                actions.append(ln[:240])
    if not characters:
        characters = [
            {"name": "Protagonist", "description": lines[0] if lines else title, "personality": "", "age": ""}
        ]
    if not scenes:
        sc = _chunk_paragraphs(story_text or title, size=2, max_chunks=4) or [title]
        scenes = [
            {"title": f"Scene {idx+1}", "description": txt[:360], "location": "", "time": ""}
            for idx, txt in enumerate(sc)
        ]
    if not actions:
        actions = [x["description"][:180] for x in scenes]
    return {"characters": characters, "scenes": scenes, "actions": actions}


def resolve_story_ai_settings(api_key: str | None, base_url: str | None, model: str | None) -> tuple[str, str, str]:
    key = (api_key or "").strip() or (settings.openai_api_key or "").strip()
    b_url = (base_url or "").strip().rstrip("/") or settings.openai_base_url.rstrip("/")
    mdl = (model or "").strip() or settings.openai_default_model
    return key, b_url, mdl


def build_story_analyze_prompt(*, story_text: str, title: str) -> str:
    return (
        "Analyze the story and return JSON with keys: characters, scenes, actions.\n"
        'characters: array of {"name": string, "description": string, "personality": string, "age": string}\n'
        'scenes: array of {"title": string, "description": string, "location": string, "time": string}\n'
        "actions: array of short beat strings\n"
        "Keep items concrete and rich, up to 8 characters and 8 scenes, up to 16 actions.\n\n"
        f"Story title: {title}\n\n"
        f"Story content:\n{story_text[:12000]}"
    )


def parse_story_analysis_raw(raw: str) -> dict[str, Any]:
    parsed = json.loads(raw)
    if not isinstance(parsed, dict):
        raise ValueError("Story analysis response is not a JSON object.")
    return {
        "characters": parsed.get("characters") if isinstance(parsed.get("characters"), list) else [],
        "scenes": parsed.get("scenes") if isinstance(parsed.get("scenes"), list) else [],
        "actions": parsed.get("actions") if isinstance(parsed.get("actions"), list) else [],
    }


def _ai_analyze_story(
    *,
    story_text: str,
    title: str,
    api_key: str | None,
    base_url: str | None,
    model: str | None,
) -> dict[str, Any]:
    key, b_url, mdl = resolve_story_ai_settings(api_key, base_url, model)
    if not key:
        raise RuntimeError("Composer requires OpenAI-compatible API key; fallback is disabled.")
    prompt = build_story_analyze_prompt(story_text=story_text, title=title)
    try:
        with httpx.Client(timeout=120.0) as client:
            r = client.post(
                f"{b_url}/chat/completions",
                headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                json={
                    "model": mdl,
                    "messages": [{"role": "user", "content": prompt}],
                    "response_format": {"type": "json_object"},
                    "temperature": 0.25,
                    "top_p": 0.9,
                    "reasoning_effort": "none",
                },
            )
            r.raise_for_status()
            raw = r.json()["choices"][0]["message"]["content"]
            return parse_story_analysis_raw(raw)
    except Exception as e:
        raise RuntimeError(f"Composer AI analysis failed: {type(e).__name__}: {str(e)[:220]}") from e


def compose_story(
    db: Session,
    *,
    title: str,
    character_ids: list[str],
    scene_ids: list[str],
    actions: list[dict],
    author: str = "",
) -> Element:
    metadata = {
        "composer": {
            "character_ids": character_ids,
            "scene_ids": scene_ids,
            "actions": actions,
        }
    }
    data = ElementCreate(
        title=title,
        content="",
        type_hint="Story",
        tags=["composed"],
        metadata=metadata,
        author=author,
    )
    return element_service.create_element(db, data)


def derive_script(db: Session, story_id: str, author: str = "") -> Element | None:
    story = db.get(Element, story_id)
    if not story or story.type_hint != "Story":
        return None
    comp = (story.metadata_ or {}).get("composer") or {}
    parts: list[str] = []
    for cid in comp.get("character_ids") or []:
        ch = db.get(Element, cid)
        if ch:
            parts.append(f"[Character: {ch.title}]\n{ch.content}")
    for sid in comp.get("scene_ids") or []:
        sc = db.get(Element, sid)
        if sc:
            parts.append(f"[Scene: {sc.title}]\n{sc.content}")
    for a in comp.get("actions") or []:
        if isinstance(a, dict) and a.get("text"):
            parts.append(str(a["text"]))
    body = "\n\n".join(parts) or story.content or "(empty script)"
    script = element_service.create_element(
        db,
        ElementCreate(
            title=f"Script — {story.title}",
            content=body,
            type_hint="Script",
            tags=["derived"],
            metadata={"derived_from": story_id},
            author=author or story.author,
        ),
    )
    rel = ElementRelation(
        parent_id=story.id,
        child_id=script.id,
        relation_type="story_to_script",
    )
    db.add(rel)
    db.commit()
    db.refresh(script)
    return script


def compose_story_graph_from_analysis(
    db: Session,
    *,
    title: str,
    story_text: str,
    analyzed: dict[str, Any],
    author: str = "",
) -> tuple[Element, str, list[str], int]:
    raw_characters = analyzed.get("characters") if isinstance(analyzed.get("characters"), list) else []
    raw_scenes = analyzed.get("scenes") if isinstance(analyzed.get("scenes"), list) else []
    raw_actions = analyzed.get("actions") if isinstance(analyzed.get("actions"), list) else []

    characters: list[dict[str, str]] = []
    for row in raw_characters[:8]:
        if isinstance(row, dict):
            name = str(row.get("name", "")).strip() or "Character"
            desc = str(row.get("description", "")).strip()
            characters.append(
                {
                    "name": name[:64],
                    "description": desc[:1500],
                    "personality": str(row.get("personality", "")).strip()[:220],
                    "age": str(row.get("age", "")).strip()[:64],
                }
            )
    scenes: list[dict[str, str]] = []
    for row in raw_scenes[:8]:
        if isinstance(row, dict):
            st = str(row.get("title", "")).strip() or "Scene"
            desc = str(row.get("description", "")).strip()
            scenes.append(
                {
                    "title": st[:80],
                    "description": desc[:2000],
                    "location": str(row.get("location", "")).strip()[:220],
                    "time": str(row.get("time", "")).strip()[:120],
                }
            )
    actions: list[dict[str, str]] = []
    for a in raw_actions[:16]:
        text = str(a).strip()
        if text:
            actions.append({"text": text[:600]})

    story = compose_story(
        db,
        title=title,
        character_ids=[],
        scene_ids=[],
        actions=actions,
        author=author,
    )
    if story_text.strip():
        story = (
            element_service.update_element(
                db,
                story.id,
                ElementUpdate(content=story_text[:20000]),
            )
            or story
        )

    created_ids = [story.id]
    relation_count = 0
    character_ids: list[str] = []
    scene_ids: list[str] = []

    for ch in characters:
        el = element_service.create_element(
            db,
            ElementCreate(
                title=ch["name"],
                content=ch["description"] or f"{ch['name']} in story {title}",
                type_hint="Character",
                tags=["auto", "composer"],
                metadata={
                    "source_story_id": story.id,
                    "personality": ch.get("personality", ""),
                    "age": ch.get("age", ""),
                },
                author=author,
            ),
        )
        created_ids.append(el.id)
        character_ids.append(el.id)
        rel, err = relation_service.create_relation(
            db,
            RelationCreate(parent_id=el.id, child_id=story.id, relation_type="character_in_story"),
        )
        if rel and not err:
            relation_count += 1

    for sc in scenes:
        el = element_service.create_element(
            db,
            ElementCreate(
                title=sc["title"],
                content=sc["description"],
                type_hint="Scene",
                tags=["auto", "composer"],
                metadata={
                    "source_story_id": story.id,
                    "location": sc.get("location", ""),
                    "time": sc.get("time", ""),
                },
                author=author,
            ),
        )
        created_ids.append(el.id)
        scene_ids.append(el.id)
        rel, err = relation_service.create_relation(
            db,
            RelationCreate(parent_id=el.id, child_id=story.id, relation_type="scene_in_story"),
        )
        if rel and not err:
            relation_count += 1

    story_meta = dict(story.metadata_ or {})
    comp = dict(story_meta.get("composer") or {})
    comp["character_ids"] = character_ids
    comp["scene_ids"] = scene_ids
    comp["actions"] = actions
    story_meta["composer"] = comp
    updated_story = element_service.update_element(
        db,
        story.id,
        ElementUpdate(metadata=story_meta),
    )
    if updated_story:
        story = updated_story

    script = derive_script(db, story.id, author=author)
    focus_id = story.id
    if script:
        created_ids.append(script.id)
        focus_id = script.id

        storyboard = element_service.create_element(
            db,
            ElementCreate(
                title=f"Storyboard — {title}",
                content="Auto-created storyboard from script.",
                type_hint="Storyboard",
                tags=["auto", "composer"],
                metadata={"derived_from_script": script.id, "source_story_id": story.id},
                author=author,
            ),
        )
        created_ids.append(storyboard.id)
        rel, err = relation_service.create_relation(
            db,
            RelationCreate(parent_id=script.id, child_id=storyboard.id, relation_type="script_to_storyboard"),
        )
        if rel and not err:
            relation_count += 1

        shot_texts = _chunk_paragraphs(story_text, size=2, max_chunks=6) or [
            "Opening shot",
            "Middle beat shot",
            "Resolution shot",
        ]
        for idx, body in enumerate(shot_texts, start=1):
            shot = element_service.create_element(
                db,
                ElementCreate(
                    title=f"Shot {idx} — {title}",
                    content=body[:2000],
                    type_hint="Shot",
                    tags=["auto", "composer"],
                    metadata={"order": idx, "source_story_id": story.id},
                    author=author,
                ),
            )
            created_ids.append(shot.id)
            focus_id = shot.id
            rel, err = relation_service.create_relation(
                db,
                RelationCreate(parent_id=storyboard.id, child_id=shot.id, relation_type="storyboard_to_shot"),
            )
            if rel and not err:
                relation_count += 1
            if scene_ids:
                scene_id = scene_ids[min(idx - 1, len(scene_ids) - 1)]
                rel, err = relation_service.create_relation(
                    db,
                    RelationCreate(parent_id=scene_id, child_id=shot.id, relation_type="scene_to_shot"),
                )
                if rel and not err:
                    relation_count += 1

    return story, focus_id, created_ids, relation_count


def compose_story_graph_from_text(
    db: Session,
    *,
    title: str,
    story_text: str,
    author: str = "",
    api_key: str | None = None,
    base_url: str | None = None,
    model: str | None = None,
) -> tuple[Element, str, list[str], int]:
    analyzed = _ai_analyze_story(
        story_text=story_text,
        title=title,
        api_key=api_key,
        base_url=base_url,
        model=model,
    )
    return compose_story_graph_from_analysis(
        db,
        title=title,
        story_text=story_text,
        analyzed=analyzed,
        author=author,
    )


def preview_story_graph_from_text(
    *,
    title: str,
    story_text: str,
    api_key: str | None = None,
    base_url: str | None = None,
    model: str | None = None,
) -> dict[str, Any]:
    analyzed = _ai_analyze_story(
        story_text=story_text,
        title=title,
        api_key=api_key,
        base_url=base_url,
        model=model,
    )
    raw_characters = analyzed.get("characters") if isinstance(analyzed.get("characters"), list) else []
    raw_scenes = analyzed.get("scenes") if isinstance(analyzed.get("scenes"), list) else []
    raw_actions = analyzed.get("actions") if isinstance(analyzed.get("actions"), list) else []

    character_rows = [
        {
            "name": str(x.get("name", "")).strip()[:64],
            "personality": str(x.get("personality", "")).strip()[:120],
            "age": str(x.get("age", "")).strip()[:48],
            "description": str(x.get("description", "")).strip()[:180],
        }
        for x in raw_characters[:8]
        if isinstance(x, dict) and str(x.get("name", "")).strip()
    ]
    scene_rows = [
        {
            "name": str(x.get("title", "")).strip()[:80],
            "location": str(x.get("location", "")).strip()[:120],
            "time": str(x.get("time", "")).strip()[:80],
            "description": str(x.get("description", "")).strip()[:180],
        }
        for x in raw_scenes[:8]
        if isinstance(x, dict) and str(x.get("title", "")).strip()
    ]
    character_names = [x["name"] for x in character_rows]
    scene_names = [x["name"] for x in scene_rows]
    shot_count = min(6, len(_chunk_paragraphs(story_text, size=2, max_chunks=6)) or 3)
    counts = {
        "Story": 1,
        "Character": max(1, len(character_names)),
        "Scene": max(1, len(scene_names)),
        "Script": 1,
        "Storyboard": 1,
        "Shot": shot_count,
    }
    # approx:
    # character->story + scene->story + story->script + script->storyboard + storyboard->shot + scene->shot
    est_rel = (
        counts["Character"]
        + counts["Scene"]
        + 1
        + 1
        + counts["Shot"]
        + counts["Shot"]
    )
    shot_rows = [
        {"name": f"Shot {idx+1}", "description": body[:180]}
        for idx, body in enumerate(_chunk_paragraphs(story_text, size=2, max_chunks=6) or ["Opening", "Middle", "End"])
    ][:6]
    timeline_nodes = [
        {"type_hint": "Story", "items": [{"name": title, "description": "Story root is created"}]},
        {"type_hint": "Character", "items": character_rows or [{"name": "Protagonist", "description": ""}]},
        {"type_hint": "Scene", "items": scene_rows or [{"name": "Scene 1", "description": ""}]},
        {"type_hint": "Script", "items": [{"name": f"Script — {title}", "description": "Derived from story and beats"}]},
        {"type_hint": "Storyboard", "items": [{"name": f"Storyboard — {title}", "description": "Derived from script"}]},
        {"type_hint": "Shot", "items": shot_rows},
    ]
    return {
        "title": title,
        "estimated_elements_by_type": counts,
        "estimated_relation_count": est_rel,
        "preview_names": {
            "Character": character_names[:6],
            "Scene": scene_names[:6],
            "Action": [str(a).strip()[:80] for a in raw_actions[:6] if str(a).strip()],
        },
        "timeline_nodes": timeline_nodes,
    }
