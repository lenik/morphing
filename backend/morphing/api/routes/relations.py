from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from morphing.api.deps import db_session
from morphing.schemas.relation import RelationCreate, RelationRead
from morphing.services import relation_service

router = APIRouter(prefix="/relations", tags=["relations"])


@router.post("", response_model=RelationRead)
def create_relation(
    payload: RelationCreate,
    db: Session = Depends(db_session),
    forbid_cycles: bool = Query(False),
    strict_relation_type: bool = Query(False),
) -> RelationRead:
    rel, err = relation_service.create_relation(
        db,
        payload,
        forbid_cycles=forbid_cycles,
        strict_relation_type=strict_relation_type,
    )
    if rel is None:
        raise HTTPException(status_code=400, detail=err or "cannot create relation")
    return RelationRead.model_validate(rel)


@router.get("/{relation_id}", response_model=RelationRead)
def get_relation(relation_id: str, db: Session = Depends(db_session)) -> RelationRead:
    rel = relation_service.get_relation(db, relation_id)
    if not rel:
        raise HTTPException(status_code=404, detail="Relation not found")
    return RelationRead.model_validate(rel)


@router.get("/by-element/{element_id}/upstream", response_model=list[RelationRead])
def list_upstream(element_id: str, db: Session = Depends(db_session)) -> list[RelationRead]:
    upstream, _ = relation_service.list_relations_for_element(db, element_id, direction="upstream")
    return [RelationRead.model_validate(r) for r in upstream]


@router.get("/by-element/{element_id}/downstream", response_model=list[RelationRead])
def list_downstream(element_id: str, db: Session = Depends(db_session)) -> list[RelationRead]:
    _, downstream = relation_service.list_relations_for_element(db, element_id, direction="downstream")
    return [RelationRead.model_validate(r) for r in downstream]


@router.get("/by-element/{element_id}", response_model=dict)
def list_both(
    element_id: str,
    db: Session = Depends(db_session),
    direction: str = Query("both", pattern="^(upstream|downstream|both)$"),
) -> dict:
    upstream, downstream = relation_service.list_relations_for_element(db, element_id, direction=direction)
    return {
        "upstream": [RelationRead.model_validate(r) for r in upstream],
        "downstream": [RelationRead.model_validate(r) for r in downstream],
    }


@router.delete("/{relation_id}", status_code=204)
def delete_relation(relation_id: str, db: Session = Depends(db_session)) -> None:
    if not relation_service.delete_relation(db, relation_id):
        raise HTTPException(status_code=404, detail="Relation not found")
