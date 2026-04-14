from fastapi import APIRouter, Depends, HTTPException
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


@router.post("/stories/{story_id}/derive-script", response_model=ElementRead)
def derive_script(story_id: str, db: Session = Depends(db_session), author: str = "") -> ElementRead:
    script = story_service.derive_script(db, story_id, author=author)
    if not script:
        raise HTTPException(status_code=400, detail="Story not found or invalid type")
    return element_read_from(script)
