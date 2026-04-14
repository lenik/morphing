from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class RelationCreate(BaseModel):
    parent_id: str
    child_id: str
    relation_type: str = Field(default="linked", max_length=64)


class RelationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    parent_id: str
    child_id: str
    relation_type: str
    created_at: datetime
