from pydantic import BaseModel

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from morphing.api.deps import db_session
from morphing.schemas.extra import ExtractRequest
from morphing.services import ai_extract_service, ai_slot_complete_service, element_service

router = APIRouter(prefix="/ai", tags=["ai"])


class CompleteSlotsBody(BaseModel):
    title: str = ""
    type_hint: str = "Idea"
    content: str = ""
    openai_api_key: str | None = None
    openai_base_url: str | None = None
    model: str | None = None
    accept_confidence: float | None = None
    allow_custom_facets: bool = True
    show_complete_request_to_llm: bool = False


@router.post("/complete-slots")
def complete_slots(payload: CompleteSlotsBody, db: Session = Depends(db_session)) -> dict:
    _ = db
    (
        slots,
        confidences,
        accepted_slots,
        extra_slots,
        extra_confidences,
        accepted_extra_slots,
        ai_trace,
    ) = ai_slot_complete_service.complete_slots(
        title=payload.title,
        type_hint=payload.type_hint,
        content=payload.content,
        api_key=payload.openai_api_key,
        base_url=payload.openai_base_url,
        model=payload.model,
        accept_confidence=payload.accept_confidence,
        allow_custom_facets=payload.allow_custom_facets,
        show_complete_request_to_llm=payload.show_complete_request_to_llm,
    )
    return {
        "slots": slots,
        "slot_confidences": confidences,
        "accepted_slots": accepted_slots,
        "extra_slots": extra_slots,
        "extra_slot_confidences": extra_confidences,
        "accepted_extra_slots": accepted_extra_slots,
        "applied_threshold": max(0.5, min(1.0, float(payload.accept_confidence if payload.accept_confidence is not None else 0.6))),
        "ai_trace": ai_trace,
    }


@router.post("/extract/{element_id}")
def extract(element_id: str, payload: ExtractRequest, db: Session = Depends(db_session)) -> dict:
    if not element_service.get_element(db, element_id):
        raise HTTPException(status_code=404, detail="Element not found")
    slots = ai_extract_service.extract_slots(db, element_id, text_override=payload.text)
    return {"element_id": element_id, "slots": slots}
