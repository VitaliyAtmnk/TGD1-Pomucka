"""SM-2 spaced repetition scheduling.

Grades used by the UI: 1 = Znovu (forgot), 3 = Těžké, 4 = Dobře, 5 = Snadné.
"""

from datetime import datetime, timedelta, timezone

from app.models import CardState

MIN_EASE = 1.3
RELEARN_MINUTES = 10


def schedule(card: CardState, grade: int, now: datetime | None = None) -> CardState:
    if not 0 <= grade <= 5:
        raise ValueError("grade must be in 0..5")
    now = now or datetime.now(timezone.utc)

    if grade < 3:
        card.repetitions = 0
        card.lapses = (card.lapses or 0) + 1
        card.interval_days = 0
        card.due_at = now + timedelta(minutes=RELEARN_MINUTES)
    else:
        reps = card.repetitions or 0
        if reps == 0:
            interval = 1.0
        elif reps == 1:
            interval = 3.0 if grade < 5 else 4.0
        else:
            interval = max(1.0, (card.interval_days or 1.0) * (card.ease or 2.5))
        if grade == 3:
            interval = max(1.0, interval * 0.8)
        card.repetitions = reps + 1
        card.interval_days = round(interval, 2)
        card.due_at = now + timedelta(days=card.interval_days)

    ease = (card.ease or 2.5) + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02))
    card.ease = max(MIN_EASE, round(ease, 3))
    card.last_grade = grade
    card.review_count = (card.review_count or 0) + 1
    card.last_reviewed_at = now
    return card
