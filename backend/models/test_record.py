from datetime import datetime

from sqlalchemy import Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


class TestRecord(Base):
    __tablename__ = "test_records"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    topic_id: Mapped[int | None] = mapped_column(ForeignKey("learning_topics.id"))
    session_id: Mapped[int | None] = mapped_column(ForeignKey("sessions.id"))
    grading_mode: Mapped[str] = mapped_column(String(20), nullable=False)
    total_score: Mapped[float | None] = mapped_column(Float)
    max_score: Mapped[float | None] = mapped_column(Float)
    questions_count: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    completed_at: Mapped[datetime | None] = mapped_column()


class QuestionResult(Base):
    __tablename__ = "question_results"

    id: Mapped[int] = mapped_column(primary_key=True)
    test_record_id: Mapped[int] = mapped_column(
        ForeignKey("test_records.id", ondelete="CASCADE")
    )
    concept_node_id: Mapped[int | None] = mapped_column(
        ForeignKey("concept_nodes.id")
    )
    question_type: Mapped[str] = mapped_column(String(20), nullable=False)
    question_text: Mapped[str] = mapped_column(Text, nullable=False)
    options: Mapped[dict | None] = mapped_column(JSONB)
    correct_answer: Mapped[str | None] = mapped_column(Text)
    ideal_answer: Mapped[str | None] = mapped_column(Text)
    user_answer: Mapped[str | None] = mapped_column(Text)
    score: Mapped[float | None] = mapped_column(Float)
    max_score: Mapped[float | None] = mapped_column(Float)
    rubric: Mapped[dict | None] = mapped_column(JSONB)
    feedback: Mapped[str | None] = mapped_column(Text)
    hints_used: Mapped[int] = mapped_column(Integer, server_default="0")
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
