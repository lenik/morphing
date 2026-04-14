from pydantic import BaseModel, Field

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from morphing.api.deps import db_session
from morphing.schemas.element import ElementCreate, ElementRead, element_read_from
from morphing.services import ai_slot_complete_service, collection_service, element_service

router = APIRouter(prefix="/collections", tags=["collections"])


class CreateCollectionBody(BaseModel):
    title: str = "New collection"
    member_ids: list[str] = Field(default_factory=list)
    author: str = ""


class PatchMembersBody(BaseModel):
    add: list[str] | None = None
    remove: list[str] | None = None


class MorphBody(BaseModel):
    target_type: str = "Character"
    openai_api_key: str | None = None
    openai_base_url: str | None = None
    model: str | None = None
    show_complete_request_to_llm: bool = False


@router.get("/containing/{element_id}", response_model=list[ElementRead])
def list_containing(element_id: str, db: Session = Depends(db_session)) -> list[ElementRead]:
    rows = collection_service.list_collections_containing(db, element_id)
    return [element_read_from(r) for r in rows]


@router.post("", response_model=ElementRead)
def create_collection(payload: CreateCollectionBody, db: Session = Depends(db_session)) -> ElementRead:
    el = collection_service.create_collection(
        db, title=payload.title, member_ids=payload.member_ids, author=payload.author
    )
    return element_read_from(el)


@router.patch("/{collection_id}/members", response_model=ElementRead)
def patch_members(
    collection_id: str, payload: PatchMembersBody, db: Session = Depends(db_session)
) -> ElementRead:
    el = collection_service.patch_members(db, collection_id, add=payload.add, remove=payload.remove)
    if not el:
        raise HTTPException(status_code=404, detail="Collection not found")
    return element_read_from(el)


@router.post("/{collection_id}/morph")
def morph_collection(
    collection_id: str, payload: MorphBody, db: Session = Depends(db_session)
) -> dict:
    coll = element_service.get_element(db, collection_id)
    if not coll or coll.type_hint != "Collection":
        raise HTTPException(status_code=404, detail="Collection not found")

    md = coll.metadata_ or {}
    raw_ids = md.get(collection_service.MEMBER_KEY) or []
    if not isinstance(raw_ids, list):
        raw_ids = []
    parts: list[str] = []
    for eid in raw_ids:
        if not isinstance(eid, str):
            continue
        el = element_service.get_element(db, eid.strip())
        if el:
            parts.append(f"--- {el.type_hint}: {el.title} ---\n{(el.content or '').strip()}\n")
    bundle = "\n".join(parts) if parts else "(empty collection)"

    suggested = f"{coll.title} → {payload.target_type}"
    title, content, meta, ai_trace = ai_slot_complete_service.morph_collection_to_element(
        member_text=bundle,
        target_type=payload.target_type,
        suggested_title=suggested,
        api_key=payload.openai_api_key,
        base_url=payload.openai_base_url,
        model=payload.model,
        show_complete_request_to_llm=payload.show_complete_request_to_llm,
    )
    meta = dict(meta)
    meta["morph_source_collection_id"] = collection_id

    created = element_service.create_element(
        db,
        ElementCreate(
            title=title,
            content=content,
            type_hint=payload.target_type,
            tags=[],
            metadata=meta,
            author=coll.author or "",
        ),
    )
    return {"element": element_read_from(created).model_dump(), "ai_trace": ai_trace}
