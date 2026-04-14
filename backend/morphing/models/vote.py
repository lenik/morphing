import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from morphing.database import Base


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Vote(Base):
    __tablename__ = "votes"
    __table_args__ = (UniqueConstraint("element_id", "voter_id", name="uq_element_voter"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    element_id: Mapped[str] = mapped_column(String(36), ForeignKey("elements.id", ondelete="CASCADE"), index=True)
    voter_id: Mapped[str] = mapped_column(String(256), default="")
    value: Mapped[int] = mapped_column(Integer, default=0)  # +1 or -1
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utc_now, onupdate=_utc_now)

    element = relationship("Element", back_populates="votes")
