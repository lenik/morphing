from datetime import datetime

from pydantic import BaseModel, ConfigDict


class CommentCreate(BaseModel):
    author: str = ""
    body: str = ""


class CommentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    element_id: str
    author: str
    body: str
    created_at: datetime
