import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from morphing.database import Base


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class ElementVersionEntry(Base):
    """Immutable snapshot of an element at version_number (the version being superseded on next edit)."""

    __tablename__ = "element_versions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    element_id: Mapped[str] = mapped_column(String(36), ForeignKey("elements.id", ondelete="CASCADE"), index=True)
    version_number: Mapped[int] = mapped_column(Integer, index=True)
    snapshot: Mapped[dict] = mapped_column(JSON, default=lambda: {})
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utc_now)

    element = relationship("Element", back_populates="version_entries")
