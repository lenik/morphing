from pydantic import BaseModel, ConfigDict, Field


class GraphEdge(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    parent_id: str
    child_id: str
    relation_type: str


class GraphNode(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    type_hint: str
    version: int


class TraversalHitRead(BaseModel):
    element_id: str
    depth: int
    via_relation_id: str | None = None


class GraphTraversalResponse(BaseModel):
    root_id: str
    direction: str
    max_depth: int
    nodes: list[GraphNode]
    edges: list[GraphEdge]
    hits: list[TraversalHitRead]


class SubgraphResponse(BaseModel):
    root_id: str
    depth: int
    direction: str
    nodes: list[GraphNode]
    edges: list[GraphEdge]
