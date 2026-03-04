import datetime as dt
from datetime import date, datetime

from sqlalchemy import Boolean, Date, Float, ForeignKey, Integer, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


class DashboardState(Base):
    __tablename__ = "dashboard_states"
    __table_args__ = (UniqueConstraint("user_id", "topic_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    topic_id: Mapped[int] = mapped_column(ForeignKey("learning_topics.id"))
    mastery_snapshot: Mapped[dict | None] = mapped_column(JSONB)
    study_plan: Mapped[dict | None] = mapped_column(JSONB)
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )


class LearnerGoal(Base):
    __tablename__ = "learner_goals"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    topic_id: Mapped[int] = mapped_column(ForeignKey("learning_topics.id"))
    concept_node_id: Mapped[int | None] = mapped_column(
        ForeignKey("concept_nodes.id")
    )
    target_mastery: Mapped[float] = mapped_column(Float, server_default="0.8")
    deadline: Mapped[date | None] = mapped_column(Date)
    priority: Mapped[int] = mapped_column(Integer, server_default="1")
    is_completed: Mapped[bool] = mapped_column(Boolean, server_default="false")
    is_ai_suggested: Mapped[bool] = mapped_column(Boolean, server_default="false")
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )
