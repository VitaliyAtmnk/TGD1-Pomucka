from app.models import CardState
from app.srs import schedule


def test_sm2_progression():
    c = CardState(ease=2.5, interval_days=0, repetitions=0, lapses=0, review_count=0)
    schedule(c, 4)
    assert c.interval_days == 1
    schedule(c, 4)
    assert c.interval_days == 3
    schedule(c, 5)
    assert c.interval_days > 3
    schedule(c, 1)
    assert c.repetitions == 0 and c.lapses == 1 and c.ease < 2.6
