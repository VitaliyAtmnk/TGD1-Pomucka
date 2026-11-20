from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.content.loader import get_store
from app.content.models import dump
from app.db import get_db
from app.exercises.registry import EXERCISES
from app.models import Attempt, CardState, User
from app.schemas import AttemptIn, CardOut, ChapterProgress, ExamProgress, ProgressSummary, ReviewIn
from app.security import get_current_user
from app.srs import schedule

router = APIRouter(prefix="/api", tags=["progress"])

WEIGHTS = {"cards": 0.4, "quiz": 0.3, "exercises": 0.2, "proofs": 0.1}


def _aware(dt: datetime | None) -> datetime | None:
    if dt is not None and dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


# --------------------------------------------------------------------------- SRS


@router.get("/srs/queue")
def srs_queue(
    chapters: list[str] = Query(default=[]),
    limit: int = Query(20, ge=1, le=100),
    new_limit: int = Query(10, ge=0, le=100),
    kinds: list[str] = Query(default=[]),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Cards to review: due cards first, then not-yet-seen items."""
    store = get_store()
    now = datetime.now(timezone.utc)
    chapter_ids = chapters or [c.id for c in store.chapters]
    eligible = [
        it
        for cid in chapter_ids
        if (ch := store.chapter(cid))
        for it in ch.items
        if not kinds or it.kind in kinds
    ]
    states = {
        s.item_id: s
        for s in db.scalars(select(CardState).where(CardState.user_id == user.id, CardState.chapter_id.in_(chapter_ids)))
    }
    due, new = [], []
    for it in eligible:
        st = states.get(it.id)
        if st is None:
            new.append(it)
        elif _aware(st.due_at) <= now:
            due.append((st.due_at, it))
    due.sort(key=lambda t: _aware(t[0]))
    picked = [it for _, it in due][:limit]
    picked += new[: max(0, min(new_limit, limit - len(picked)))]

    def card(it):
        st = states.get(it.id)
        return {
            "item": {**dump(it), "chapter_id": store.item_chapter[it.id]},
            "state": CardOut.model_validate(st).model_dump() if st else None,
        }

    return {
        "cards": [card(it) for it in picked],
        "due_count": len(due),
        "new_count": len(new),
        "total": len(eligible),
    }


@router.post("/srs/review", response_model=CardOut)
def srs_review(body: ReviewIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> CardState:
    store = get_store()
    if body.item_id not in store.items:
        raise HTTPException(404, "Položka neexistuje")
    chapter_id = store.item_chapter[body.item_id]
    card = db.scalar(select(CardState).where(CardState.user_id == user.id, CardState.item_id == body.item_id))
    if card is None:
        card = CardState(user_id=user.id, item_id=body.item_id, chapter_id=chapter_id)
        db.add(card)
    schedule(card, body.grade)
    db.add(
        Attempt(
            user_id=user.id,
            kind="card",
            chapter_id=chapter_id,
            ref_id=body.item_id,
            correct=body.grade >= 3,
            score=body.grade / 5,
        )
    )
    db.commit()
    db.refresh(card)
    return card


@router.get("/srs/cards", response_model=list[CardOut])
def srs_cards(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[CardState]:
    return list(db.scalars(select(CardState).where(CardState.user_id == user.id)))


# --------------------------------------------------------------------- attempts


@router.post("/progress/attempts", status_code=201)
def add_attempt(body: AttemptIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    store = get_store()
    if body.chapter_id and not store.chapter(body.chapter_id):
        raise HTTPException(404, "Kapitola neexistuje")
    score = body.score if body.score is not None else (1.0 if body.correct else 0.0)
    a = Attempt(
        user_id=user.id,
        kind=body.kind,
        chapter_id=body.chapter_id,
        ref_id=body.ref_id,
        correct=body.correct,
        score=score,
    )
    db.add(a)
    db.commit()
    return {"id": a.id}


@router.get("/progress/history")
def history(
    days: int = Query(30, ge=1, le=365),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    """Number of answered things per day (for an activity chart)."""
    since = datetime.now(timezone.utc) - timedelta(days=days)
    per_day: dict[date, dict[str, int]] = defaultdict(lambda: {"total": 0, "correct": 0})
    for a in db.scalars(select(Attempt).where(Attempt.user_id == user.id, Attempt.created_at >= since)):
        d = _aware(a.created_at).date()
        per_day[d]["total"] += 1
        per_day[d]["correct"] += int(a.correct)
    return [{"date": d.isoformat(), **v} for d, v in sorted(per_day.items())]


@router.delete("/progress", status_code=204)
def reset_progress(
    chapter_id: str | None = None, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> None:
    cs = delete(CardState).where(CardState.user_id == user.id)
    at = delete(Attempt).where(Attempt.user_id == user.id)
    if chapter_id:
        cs = cs.where(CardState.chapter_id == chapter_id)
        at = at.where(Attempt.chapter_id == chapter_id)
    db.execute(cs)
    db.execute(at)
    db.commit()


# ---------------------------------------------------------------------- summary


def _latest_by_ref(attempts: list[Attempt]) -> dict[str, Attempt]:
    latest: dict[str, Attempt] = {}
    for a in sorted(attempts, key=lambda a: _aware(a.created_at)):
        latest[a.ref_id] = a
    return latest


def _streak(days: set[date]) -> int:
    today = datetime.now(timezone.utc).date()
    d = today if today in days else today - timedelta(days=1)
    streak = 0
    while d in days:
        streak += 1
        d -= timedelta(days=1)
    return streak


@router.get("/progress/summary", response_model=ProgressSummary)
def summary(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> ProgressSummary:
    store = get_store()
    now = datetime.now(timezone.utc)
    cards = list(db.scalars(select(CardState).where(CardState.user_id == user.id)))
    attempts = list(db.scalars(select(Attempt).where(Attempt.user_id == user.id)))

    cards_by_ch: dict[str, list[CardState]] = defaultdict(list)
    for c in cards:
        cards_by_ch[c.chapter_id].append(c)
    att_by: dict[tuple[str | None, str], list[Attempt]] = defaultdict(list)
    for a in attempts:
        att_by[(a.chapter_id, a.kind)].append(a)

    exercise_chapters = {e.chapter for e in EXERCISES.values()}
    chapters_out: list[ChapterProgress] = []
    for ch in store.chapters:
        ch_cards = [c for c in cards_by_ch[ch.id] if c.item_id in store.items]
        total = len(ch.items)
        learned = [c for c in ch_cards if c.repetitions >= 1 and (c.last_grade or 0) >= 3]
        card_score = sum(min(c.repetitions, 3) / 3 for c in learned) / total if total else None
        due = sum(1 for c in ch_cards if _aware(c.due_at) <= now)

        quiz_ids = {q.id for q in ch.quiz}
        quiz_latest = {k: v for k, v in _latest_by_ref(att_by[(ch.id, "quiz")]).items() if k in quiz_ids}
        quiz_acc = (sum(a.correct for a in quiz_latest.values()) / len(quiz_latest)) if quiz_latest else None
        quiz_score = (sum(a.correct for a in quiz_latest.values()) / len(quiz_ids)) if quiz_ids else None

        ex = sorted(att_by[(ch.id, "exercise")], key=lambda a: _aware(a.created_at))[-10:]
        ex_acc = (sum(a.score for a in ex) / len(ex)) if ex else None
        ex_score = (ex_acc or 0.0) if ch.id in exercise_chapters else None

        proof_ids = {it.id for it in ch.items if len(it.proof_steps) >= 3}
        proof_latest = {k: v for k, v in _latest_by_ref(att_by[(ch.id, "proof")]).items() if k in proof_ids}
        proof_acc = (sum(a.score for a in proof_latest.values()) / len(proof_latest)) if proof_latest else None
        proof_score = (sum(a.score for a in proof_latest.values()) / len(proof_ids)) if proof_ids else None

        parts = {"cards": card_score, "quiz": quiz_score, "exercises": ex_score, "proofs": proof_score}
        wsum = sum(WEIGHTS[k] for k, v in parts.items() if v is not None)
        mastery = sum(WEIGHTS[k] * v for k, v in parts.items() if v is not None) / wsum if wsum else 0.0

        chapters_out.append(
            ChapterProgress(
                chapter_id=ch.id,
                mastery=round(mastery, 4),
                cards_total=total,
                cards_learned=len(learned),
                cards_due=due,
                quiz_answered=len(quiz_latest),
                quiz_accuracy=quiz_acc,
                exercise_attempts=len(att_by[(ch.id, "exercise")]),
                exercise_accuracy=ex_acc,
                proof_attempts=len(att_by[(ch.id, "proof")]),
                proof_accuracy=proof_acc,
            )
        )

    exam_att = defaultdict(list)
    for a in attempts:
        if a.kind == "exam":
            exam_att[a.ref_id].append(a)
    exam_out = []
    for q in store.exam:
        lst = sorted(exam_att.get(str(q.number), []), key=lambda a: _aware(a.created_at))
        exam_out.append(
            ExamProgress(
                number=q.number,
                last_score=lst[-1].score if lst else None,
                attempts=len(lst),
                last_at=lst[-1].created_at if lst else None,
            )
        )

    active_days = {_aware(a.created_at).date() for a in attempts}
    return ProgressSummary(
        chapters=chapters_out,
        exam=exam_out,
        total_reviews=sum(1 for a in attempts if a.kind == "card"),
        streak_days=_streak(active_days),
    )
