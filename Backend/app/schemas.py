from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    display_name: str = Field(min_length=1, max_length=100)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    email: str
    display_name: str
    created_at: datetime


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class ReviewIn(BaseModel):
    item_id: str
    grade: int = Field(ge=0, le=5)


class CardOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    item_id: str
    chapter_id: str
    ease: float
    interval_days: float
    repetitions: int
    lapses: int
    review_count: int
    last_grade: int | None
    due_at: datetime
    last_reviewed_at: datetime | None


AttemptKind = Literal["quiz", "exercise", "proof", "exam"]


class AttemptIn(BaseModel):
    kind: AttemptKind
    ref_id: str = Field(max_length=120)
    chapter_id: str | None = None
    correct: bool
    score: float | None = Field(default=None, ge=0, le=1)


class ChapterProgress(BaseModel):
    chapter_id: str
    mastery: float  # 0..1
    cards_total: int
    cards_learned: int
    cards_due: int
    quiz_answered: int
    quiz_accuracy: float | None
    exercise_attempts: int
    exercise_accuracy: float | None
    proof_attempts: int
    proof_accuracy: float | None


class ExamProgress(BaseModel):
    number: int
    last_score: float | None
    attempts: int
    last_at: datetime | None


class ProgressSummary(BaseModel):
    chapters: list[ChapterProgress]
    exam: list[ExamProgress]
    total_reviews: int
    streak_days: int


class GraphIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    data: dict[str, Any]


class GraphOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    data: dict[str, Any]
    created_at: datetime
    updated_at: datetime
