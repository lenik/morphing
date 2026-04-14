from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from morphing.models.element import Element


class ElementBase(BaseModel):
    title: str = ""
    content: str = ""
    type_hint: str = "Idea"
    tags: list[str] = Field(default_factory=list)
    metadata: dict = Field(default_factory=dict)
    author: str = ""


class ElementCreate(ElementBase):
    pass


class ElementUpdate(BaseModel):
    title: str | None = None
    content: str | None = None
    type_hint: str | None = None
    tags: list[str] | None = None
    metadata: dict | None = None
    author: str | None = None


class ElementRead(ElementBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    version: int
    created_at: datetime
    updated_at: datetime


def element_read_from(el: Element) -> ElementRead:
    return ElementRead(
        id=el.id,
        title=el.title,
        content=el.content,
        type_hint=el.type_hint,
        tags=list(el.tags) if el.tags is not None else [],
        metadata=dict(el.metadata_) if el.metadata_ is not None else {},
        author=el.author,
        version=el.version,
        created_at=el.created_at,
        updated_at=el.updated_at,
    )
