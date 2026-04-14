import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from morphing.database import Base


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class ElementRelation(Base):
    __tablename__ = "element_relations"
    __table_args__ = (UniqueConstraint("parent_id", "child_id", "relation_type", name="uq_parent_child_type"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    parent_id: Mapped[str] = mapped_column(String(36), ForeignKey("elements.id", ondelete="CASCADE"), index=True)
    child_id: Mapped[str] = mapped_column(String(36), ForeignKey("elements.id", ondelete="CASCADE"), index=True)
    relation_type: Mapped[str] = mapped_column(String(64), default="linked")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utc_now)

    parent = relationship("Element", foreign_keys=[parent_id], back_populates="outgoing_relations")
    child = relationship("Element", foreign_keys=[child_id], back_populates="incoming_relations")
