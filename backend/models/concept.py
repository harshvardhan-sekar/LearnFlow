from datetime import datetime

from sqlalchemy import ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


class ConceptGraph(Base):
    __tablename__ = "concept_graphs"

    id: Mapped[int] = mapped_column(primary_key=True)
    topic_id: Mapped[int] = mapped_column(
        ForeignKey("learning_topics.id", ondelete="CASCADE")
    )
    graph_data: Mapped[dict] = mapped_column(JSONB, nullable=False)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )


class ConceptNode(Base):
    __tablename__ = "concept_nodes"
    __table_args__ = (UniqueConstraint("graph_id", "key"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    graph_id: Mapped[int] = mapped_column(
        ForeignKey("concept_graphs.id", ondelete="CASCADE")
    )
    key: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    difficulty: Mapped[str] = mapped_column(String(20), server_default="medium")
    prerequisites: Mapped[dict | None] = mapped_column(JSONB, server_default="[]")
    sort_order: Mapped[int] = mapped_column(Integer, server_default="0")
