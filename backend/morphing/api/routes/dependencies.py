from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from morphing.api.deps import db_session
from morphing.services import dependency_service, element_service, graph_service

router = APIRouter(prefix="/dependencies", tags=["dependencies"])


@router.get("/query/downstream/{element_id}")
def query_downstream(element_id: str, db: Session = Depends(db_session), depth: int = 8) -> dict:
    if not element_service.get_element(db, element_id):
        raise HTTPException(status_code=404, detail="Element not found")
    nodes, _, _ = graph_service.traverse_downstream(db, element_id, depth)
    outdated = [nid for nid in nodes if nid != element_id]
    return {"root_id": element_id, "downstream_ids": outdated, "count": len(outdated)}


@router.post("/clear-outdated/{element_id}")
def clear_outdated(element_id: str, db: Session = Depends(db_session)) -> dict:
    ok = dependency_service.clear_outdated(db, element_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Element not found")
    return {"ok": True}
