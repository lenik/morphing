import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from morphing.database import Base


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Element(Base):
    __tablename__ = "elements"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    title: Mapped[str] = mapped_column(String(512), default="")
    content: Mapped[str] = mapped_column(Text, default="")
    type_hint: Mapped[str] = mapped_column(String(64), default="Idea", index=True)
    tags: Mapped[list] = mapped_column(JSON, default=lambda: [])
    metadata_: Mapped[dict] = mapped_column("metadata", JSON, default=lambda: {})
    author: Mapped[str] = mapped_column(String(256), default="")
    version: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utc_now, onupdate=_utc_now)

    comments = relationship("Comment", back_populates="element", cascade="all, delete-orphan")
    votes = relationship("Vote", back_populates="element", cascade="all, delete-orphan")
    outgoing_relations = relationship(
        "ElementRelation",
        foreign_keys="ElementRelation.parent_id",
        back_populates="parent",
        cascade="all, delete-orphan",
    )
    incoming_relations = relationship(
        "ElementRelation",
        foreign_keys="ElementRelation.child_id",
        back_populates="child",
        cascade="all, delete-orphan",
    )
    version_entries = relationship(
        "ElementVersionEntry",
        back_populates="element",
        cascade="all, delete-orphan",
    )
