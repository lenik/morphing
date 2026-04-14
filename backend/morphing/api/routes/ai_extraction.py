from pydantic import BaseModel

import json

import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
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
    locale: str | None = None


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
        accepted_title,
        accepted_body,
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
        locale=payload.locale,
    )
    return {
        "slots": slots,
        "slot_confidences": confidences,
        "accepted_slots": accepted_slots,
        "extra_slots": extra_slots,
        "extra_slot_confidences": extra_confidences,
        "accepted_extra_slots": accepted_extra_slots,
        "accepted_title": accepted_title,
        "accepted_body": accepted_body,
        "applied_threshold": max(0.5, min(1.0, float(payload.accept_confidence if payload.accept_confidence is not None else 0.6))),
        "ai_trace": ai_trace,
    }


@router.post("/complete-slots-stream")
async def complete_slots_stream(payload: CompleteSlotsBody, db: Session = Depends(db_session)) -> StreamingResponse:
    _ = db

    async def event_gen():
        key, b_url, mdl = ai_slot_complete_service.resolve_ai_settings(
            payload.openai_api_key,
            payload.openai_base_url,
            payload.model,
        )
        _, prompt = ai_slot_complete_service.build_complete_slots_prompt(
            type_hint=payload.type_hint,
            title=payload.title,
            content=payload.content,
            allow_custom_facets=payload.allow_custom_facets,
            locale=payload.locale,
        )
        llm_preview = ai_slot_complete_service._llm_request_preview(base_url=b_url, model=mdl, prompt=prompt, stream=True)
        threshold = max(0.5, min(1.0, float(payload.accept_confidence if payload.accept_confidence is not None else 0.6)))

        if not key:
            (
                slots,
                confidences,
                accepted_slots,
                extra_slots,
                extra_confidences,
                accepted_extra_slots,
                accepted_title,
                accepted_body,
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
                locale=payload.locale,
            )
            yield json.dumps(
                {
                    "type": "final",
                    "slots": slots,
                    "slot_confidences": confidences,
                    "accepted_slots": accepted_slots,
                    "extra_slots": extra_slots,
                    "extra_slot_confidences": extra_confidences,
                    "accepted_extra_slots": accepted_extra_slots,
                    "accepted_title": accepted_title,
                    "accepted_body": accepted_body,
                    "applied_threshold": threshold,
                    "ai_trace": ai_trace,
                },
                ensure_ascii=False,
            ) + "\n"
            return

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
                        **ai_slot_complete_service.DEFAULT_CHAT_COMPLETIONS_OPTIONS,
                        "stream": True,
                    },
                ) as r:
                    r.raise_for_status()
                    async for line in r.aiter_lines():
                        if not line:
                            continue
                        if not line.startswith("data:"):
                            continue
                        data_line = line[5:].strip()
                        if data_line == "[DONE]":
                            break
                        try:
                            packet = json.loads(data_line)
                        except Exception:
                            continue
                        delta = ""
                        reasoning = ""
                        try:
                            delta = packet.get("choices", [{}])[0].get("delta", {}).get("content", "") or ""
                            reasoning = (
                                packet.get("choices", [{}])[0].get("delta", {}).get("reasoning", "")
                                or packet.get("choices", [{}])[0].get("delta", {}).get("reasoning_content", "")
                                or ""
                            )
                        except Exception:
                            delta = ""
                            reasoning = ""
                        if delta:
                            raw_parts.append(delta)
                            yield json.dumps({"type": "delta", "text": delta}, ensure_ascii=False) + "\n"
                        if reasoning:
                            yield json.dumps({"type": "reasoning", "text": reasoning}, ensure_ascii=False) + "\n"
        except Exception as e:
            yield json.dumps({"type": "error", "message": str(e)[:240]}, ensure_ascii=False) + "\n"
            (
                slots,
                confidences,
                accepted_slots,
                extra_slots,
                extra_confidences,
                accepted_extra_slots,
                accepted_title,
                accepted_body,
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
                locale=payload.locale,
            )
            yield json.dumps(
                {
                    "type": "final",
                    "slots": slots,
                    "slot_confidences": confidences,
                    "accepted_slots": accepted_slots,
                    "extra_slots": extra_slots,
                    "extra_slot_confidences": extra_confidences,
                    "accepted_extra_slots": accepted_extra_slots,
                    "accepted_title": accepted_title,
                    "accepted_body": accepted_body,
                    "applied_threshold": threshold,
                    "ai_trace": ai_trace,
                },
                ensure_ascii=False,
            ) + "\n"
            return

        raw = "".join(raw_parts)
        (
            slots,
            confidences,
            accepted_slots,
            extra_slots,
            extra_confidences,
            accepted_extra_slots,
            accepted_title,
            accepted_body,
            ai_trace,
        ) = ai_slot_complete_service.parse_complete_slots_raw(
            raw=raw,
            title=payload.title,
            type_hint=payload.type_hint,
            content=payload.content,
            model=mdl,
            accept_confidence=payload.accept_confidence,
            allow_custom_facets=payload.allow_custom_facets,
            show_complete_request_to_llm=payload.show_complete_request_to_llm,
            llm_request=llm_preview,
            locale=payload.locale,
        )
        yield json.dumps(
            {
                "type": "final",
                "slots": slots,
                "slot_confidences": confidences,
                "accepted_slots": accepted_slots,
                "extra_slots": extra_slots,
                "extra_slot_confidences": extra_confidences,
                "accepted_extra_slots": accepted_extra_slots,
                "accepted_title": accepted_title,
                "accepted_body": accepted_body,
                "applied_threshold": threshold,
                "ai_trace": ai_trace,
            },
            ensure_ascii=False,
        ) + "\n"

    return StreamingResponse(event_gen(), media_type="application/x-ndjson")


@router.post("/extract/{element_id}")
def extract(element_id: str, payload: ExtractRequest, db: Session = Depends(db_session)) -> dict:
    if not element_service.get_element(db, element_id):
        raise HTTPException(status_code=404, detail="Element not found")
    slots = ai_extract_service.extract_slots(db, element_id, text_override=payload.text)
    return {"element_id": element_id, "slots": slots}
