from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db import get_db
from app.exercises.registry import EXERCISES, build, new_seed
from app.models import Attempt, User
from app.security import get_optional_user

router = APIRouter(prefix="/api/exercises", tags=["exercises"])


class GenerateIn(BaseModel):
    type: str
    seed: str | None = Field(default=None, max_length=40)
    difficulty: int = Field(default=1, ge=1, le=2)


class CheckIn(BaseModel):
    type: str
    seed: str = Field(max_length=40)
    difficulty: int = Field(default=1, ge=1, le=2)
    answer: Any


def _get(type_: str):
    ex = EXERCISES.get(type_)
    if not ex:
        raise HTTPException(404, "Neznámý typ příkladu")
    return ex


@router.get("")
def list_types() -> list[dict[str, str]]:
    return [{"id": e.id, "title": e.title, "chapter": e.chapter, "description": e.description} for e in EXERCISES.values()]


@router.post("/generate")
def generate(body: GenerateIn) -> dict[str, Any]:
    ex = _get(body.type)
    seed = body.seed or new_seed()
    task = build(ex.id, seed, body.difficulty)
    return {
        "type": ex.id,
        "title": ex.title,
        "chapter": ex.chapter,
        "seed": seed,
        "difficulty": body.difficulty,
        "prompt": task.prompt,
        "answer_spec": task.answer_spec,
        "data": task.data,
    }


@router.post("/check")
def check(
    body: CheckIn,
    user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    ex = _get(body.type)
    task = build(ex.id, body.seed, body.difficulty)
    correct, score = ex.check(task, body.answer)
    if user is not None:
        db.add(
            Attempt(
                user_id=user.id,
                kind="exercise",
                chapter_id=ex.chapter,
                ref_id=ex.id,
                correct=correct,
                score=score,
            )
        )
        db.commit()
    return {"correct": correct, "score": score, "explanation": task.explanation}
