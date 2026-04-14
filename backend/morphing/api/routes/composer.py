import json

import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from morphing.api.deps import db_session
from morphing.schemas.element import ElementRead, element_read_from
from morphing.schemas.extra import (
    StoryComposePreviewResponse,
    StoryComposeRequest,
    StoryComposeResponse,
)
from morphing.services import story_service

router = APIRouter(prefix="/composer", tags=["composer"])


@router.post("/stories/preview", response_model=StoryComposePreviewResponse)
def preview_story(payload: StoryComposeRequest, db: Session = Depends(db_session)) -> StoryComposePreviewResponse:
    _ = db
    return StoryComposePreviewResponse(
        **story_service.preview_story_graph_from_text(
            title=payload.title,
            story_text=payload.story_text,
            api_key=payload.openai_api_key,
            base_url=payload.openai_base_url,
            model=payload.model,
        )
    )


@router.post("/stories", response_model=StoryComposeResponse)
def compose_story(payload: StoryComposeRequest, db: Session = Depends(db_session)) -> StoryComposeResponse:
    if payload.story_text.strip():
        story, focus_id, created_ids, relation_count = story_service.compose_story_graph_from_text(
            db,
            title=payload.title,
            story_text=payload.story_text,
            author=payload.author,
            api_key=payload.openai_api_key,
            base_url=payload.openai_base_url,
            model=payload.model,
        )
        return StoryComposeResponse(
            id=story.id,
            story_id=story.id,
            focus_element_id=focus_id,
            created_element_ids=created_ids,
            created_relation_count=relation_count,
        )
    el = story_service.compose_story(
        db,
        title=payload.title,
        character_ids=payload.character_ids,
        scene_ids=payload.scene_ids,
        actions=payload.actions,
        author=payload.author,
    )
    _ = element_read_from(el)
    return StoryComposeResponse(
        id=el.id,
        story_id=el.id,
        focus_element_id=el.id,
        created_element_ids=[el.id],
        created_relation_count=0,
    )


@router.post("/stories/stream")
async def compose_story_stream(payload: StoryComposeRequest, db: Session = Depends(db_session)) -> StreamingResponse:
    async def event_gen():
        if not payload.story_text.strip():
            yield json.dumps({"type": "error", "message": "Story content is required."}, ensure_ascii=False) + "\n"
            return

        key, b_url, mdl = story_service.resolve_story_ai_settings(
            payload.openai_api_key,
            payload.openai_base_url,
            payload.model,
        )
        if not key:
            yield json.dumps(
                {"type": "error", "message": "Composer requires OpenAI-compatible API key; fallback is disabled."},
                ensure_ascii=False,
            ) + "\n"
            return

        prompt = story_service.build_story_analyze_prompt(story_text=payload.story_text, title=payload.title)
        raw_parts: list[str] = []
        try:
            async with httpx.AsyncClient(timeout=180.0) as client:
                async with client.stream(
                    "POST",
                    f"{b_url}/chat/completions",
                    headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                    json={
                        "model": mdl,
                        "messages": [{"role": "user", "content": prompt}],
                        "response_format": {"type": "json_object"},
                        "temperature": 0.25,
                        "top_p": 0.9,
                        "reasoning_effort": "none",
                        "stream": True,
                    },
                ) as r:
                    r.raise_for_status()
                    async for line in r.aiter_lines():
                        if not line or not line.startswith("data:"):
                            continue
                        data_line = line[5:].strip()
                        if data_line == "[DONE]":
                            break
                        try:
                            packet = json.loads(data_line)
                        except Exception:
                            continue
                        delta = packet.get("choices", [{}])[0].get("delta", {}).get("content", "") or ""
                        reasoning = (
                            packet.get("choices", [{}])[0].get("delta", {}).get("reasoning", "")
                            or packet.get("choices", [{}])[0].get("delta", {}).get("reasoning_content", "")
                            or ""
                        )
                        if delta:
                            raw_parts.append(delta)
                            yield json.dumps({"type": "delta", "text": delta}, ensure_ascii=False) + "\n"
                        if reasoning:
                            yield json.dumps({"type": "reasoning", "text": reasoning}, ensure_ascii=False) + "\n"
        except Exception as e:
            yield json.dumps({"type": "error", "message": f"{type(e).__name__}: {str(e)[:240]}"}, ensure_ascii=False) + "\n"
            return

        try:
            analyzed = story_service.parse_story_analysis_raw("".join(raw_parts))
            story, focus_id, created_ids, relation_count = story_service.compose_story_graph_from_analysis(
                db,
                title=payload.title,
                story_text=payload.story_text,
                analyzed=analyzed,
                author=payload.author,
            )
            yield json.dumps(
                {
                    "type": "final",
                    "id": story.id,
                    "story_id": story.id,
                    "focus_element_id": focus_id,
                    "created_element_ids": created_ids,
                    "created_relation_count": relation_count,
                },
                ensure_ascii=False,
            ) + "\n"
        except Exception as e:
            yield json.dumps({"type": "error", "message": f"{type(e).__name__}: {str(e)[:240]}"}, ensure_ascii=False) + "\n"

    return StreamingResponse(event_gen(), media_type="application/x-ndjson")


@router.post("/stories/{story_id}/derive-script", response_model=ElementRead)
def derive_script(story_id: str, db: Session = Depends(db_session), author: str = "") -> ElementRead:
    script = story_service.derive_script(db, story_id, author=author)
    if not script:
        raise HTTPException(status_code=400, detail="Story not found or invalid type")
    return element_read_from(script)
