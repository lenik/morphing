from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from morphing.models import Element, ElementRelation


@dataclass(frozen=True)
class TraversalHit:
    element_id: str
    depth: int
    via_relation_id: str | None


def _element_summary(el: Element) -> dict:
    return {
        "id": el.id,
        "title": el.title,
        "type_hint": el.type_hint,
        "version": el.version,
    }


def traverse_upstream(
    db: Session, root_id: str, max_depth: int, *, max_nodes: int = 800
) -> tuple[dict[str, dict], list[dict], list[TraversalHit]]:
    """Follow parent <- child (incoming to current)."""
    nodes: dict[str, dict] = {}
    edges: list[dict] = []
    hits: list[TraversalHit] = []
    edge_ids: set[str] = set()
    if not db.get(Element, root_id):
        return {}, [], []
    frontier: set[str] = {root_id}
    for depth in range(max_depth + 1):
        for eid in list(frontier):
            if len(nodes) >= max_nodes:
                break
            el = db.get(Element, eid)
            if el:
                nodes[eid] = _element_summary(el)
        if depth == max_depth:
            break
        next_frontier: set[str] = set()
        for eid in frontier:
            rels = list(db.scalars(select(ElementRelation).where(ElementRelation.child_id == eid)).all())
            for r in rels:
                if r.id not in edge_ids:
                    edge_ids.add(r.id)
                    edges.append(
                        {
                            "id": r.id,
                            "parent_id": r.parent_id,
                            "child_id": r.child_id,
                            "relation_type": r.relation_type,
                        }
                    )
                next_frontier.add(r.parent_id)
                hits.append(TraversalHit(r.parent_id, depth + 1, r.id))
        frontier = next_frontier
        if not frontier:
            break
    return nodes, edges, hits


def traverse_downstream(
    db: Session, root_id: str, max_depth: int, *, max_nodes: int = 800
) -> tuple[dict[str, dict], list[dict], list[TraversalHit]]:
    """Follow parent -> child edges."""
    nodes: dict[str, dict] = {}
    edges: list[dict] = []
    hits: list[TraversalHit] = []
    edge_ids: set[str] = set()
    if not db.get(Element, root_id):
        return {}, [], []
    frontier: set[str] = {root_id}
    for depth in range(max_depth + 1):
        for eid in list(frontier):
            if len(nodes) >= max_nodes:
                break
            el = db.get(Element, eid)
            if el:
                nodes[eid] = _element_summary(el)
        if depth == max_depth:
            break
        next_frontier: set[str] = set()
        for eid in frontier:
            rels = list(db.scalars(select(ElementRelation).where(ElementRelation.parent_id == eid)).all())
            for r in rels:
                if r.id not in edge_ids:
                    edge_ids.add(r.id)
                    edges.append(
                        {
                            "id": r.id,
                            "parent_id": r.parent_id,
                            "child_id": r.child_id,
                            "relation_type": r.relation_type,
                        }
                    )
                next_frontier.add(r.child_id)
                hits.append(TraversalHit(r.child_id, depth + 1, r.id))
        frontier = next_frontier
        if not frontier:
            break
    return nodes, edges, hits


def load_subgraph(
    db: Session,
    root_id: str,
    *,
    depth: int,
    direction: str = "both",
) -> dict:
    all_nodes: dict[str, dict] = {}
    edge_map: dict[str, dict] = {}

    def absorb(nodes: dict[str, dict], edgelist: list[dict]) -> None:
        all_nodes.update(nodes)
        for e in edgelist:
            edge_map[e["id"]] = e

    if direction in ("upstream", "both"):
        n, ed, _ = traverse_upstream(db, root_id, depth)
        absorb(n, ed)
    if direction in ("downstream", "both"):
        n, ed, _ = traverse_downstream(db, root_id, depth)
        absorb(n, ed)

    el = db.get(Element, root_id)
    if el and root_id not in all_nodes:
        all_nodes[root_id] = _element_summary(el)

    return {
        "root_id": root_id,
        "depth": depth,
        "direction": direction,
        "nodes": list(all_nodes.values()),
        "edges": list(edge_map.values()),
    }
