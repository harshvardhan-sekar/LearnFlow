from datetime import datetime

from sqlalchemy import Float, ForeignKey, Integer, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


class MasteryState(Base):
    __tablename__ = "mastery_states"
    __table_args__ = (UniqueConstraint("user_id", "concept_node_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    concept_node_id: Mapped[int] = mapped_column(
        ForeignKey("concept_nodes.id", ondelete="CASCADE")
    )
    mastery_score: Mapped[float] = mapped_column(Float, server_default="0.0")
    attempts_count: Mapped[int] = mapped_column(Integer, server_default="0")
    correct_count: Mapped[int] = mapped_column(Integer, server_default="0")
    last_tested_at: Mapped[datetime | None] = mapped_column()
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )
