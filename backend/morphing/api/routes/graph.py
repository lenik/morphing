from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from morphing.api.deps import db_session
from morphing.models import Element
from morphing.schemas.graph import (
    GraphEdge,
    GraphNode,
    GraphTraversalResponse,
    SubgraphResponse,
    TraversalHitRead,
)
from morphing.services import graph_service

router = APIRouter(prefix="/graph", tags=["graph"])


@router.get("/elements/{element_id}/traverse", response_model=GraphTraversalResponse)
def traverse(
    element_id: str,
    direction: Literal["upstream", "downstream"],
    db: Session = Depends(db_session),
    max_depth: int = Query(3, ge=0, le=50),
) -> GraphTraversalResponse:
    if not db.get(Element, element_id):
        raise HTTPException(status_code=404, detail="Element not found")
    if direction == "upstream":
        nodes, edges, hits = graph_service.traverse_upstream(db, element_id, max_depth)
    else:
        nodes, edges, hits = graph_service.traverse_downstream(db, element_id, max_depth)
    return GraphTraversalResponse(
        root_id=element_id,
        direction=direction,
        max_depth=max_depth,
        nodes=[GraphNode.model_validate(n) for n in nodes.values()],
        edges=[GraphEdge.model_validate(e) for e in edges],
        hits=[
            TraversalHitRead(element_id=h.element_id, depth=h.depth, via_relation_id=h.via_relation_id)
            for h in hits
        ],
    )


@router.get("/elements/{element_id}/load", response_model=SubgraphResponse)
def load_subgraph(
    element_id: str,
    db: Session = Depends(db_session),
    depth: int = Query(2, ge=0, le=50),
    direction: str = Query("both", pattern="^(upstream|downstream|both)$"),
) -> SubgraphResponse:
    if not db.get(Element, element_id):
        raise HTTPException(status_code=404, detail="Element not found")
    data = graph_service.load_subgraph(db, element_id, depth=depth, direction=direction)
    return SubgraphResponse(
        root_id=data["root_id"],
        depth=data["depth"],
        direction=data["direction"],
        nodes=[GraphNode.model_validate(n) for n in data["nodes"]],
        edges=[GraphEdge.model_validate(e) for e in data["edges"]],
    )
