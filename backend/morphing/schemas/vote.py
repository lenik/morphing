from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class VoteUpsert(BaseModel):
    voter_id: str = ""
    value: int = Field(..., ge=-1, le=1, description="Use -1, 0 (neutral/remove), or +1")


class VoteRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    element_id: str
    voter_id: str
    value: int
    created_at: datetime
    updated_at: datetime
