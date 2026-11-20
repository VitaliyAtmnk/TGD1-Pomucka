from typing import Any

from fastapi import APIRouter, HTTPException, Query

from app.content.loader import get_store
from app.content.models import VISUALIZATIONS, dump

router = APIRouter(prefix="/api", tags=["content"])


def _item_brief(item, chapter) -> dict[str, Any]:
    return {
        "id": item.id,
        "kind": item.kind,
        "label": item.label,
        "title": item.title,
        "section": item.section,
        "terms": item.terms,
        "supplemented": item.supplemented,
        "has_proof": bool(item.proof),
        "visualization": item.visualization,
        "illustrations": len(item.illustrations),
        "chapter": {"id": chapter.id, "number": chapter.number, "title": chapter.title},
    }


@router.get("/chapters")
def list_chapters() -> list[dict[str, Any]]:
    store = get_store()
    out = []
    for ch in store.chapters:
        counts: dict[str, int] = {}
        for it in ch.items:
            counts[it.kind] = counts.get(it.kind, 0) + 1
        out.append(
            {
                "id": ch.id,
                "number": ch.number,
                "title": ch.title,
                "summary": ch.summary,
                "source": ch.source,
                "exam_questions": ch.exam_questions,
                "sections": [dump(s) for s in ch.sections],
                "counts": counts,
                "item_count": len(ch.items),
                "quiz_count": len(ch.quiz),
                "proof_count": sum(1 for it in ch.items if len(it.proof_steps) >= 3),
            }
        )
    return out


@router.get("/chapters/{chapter_id}")
def get_chapter(chapter_id: str) -> dict[str, Any]:
    ch = get_store().chapter(chapter_id)
    if not ch:
        raise HTTPException(404, "Kapitola neexistuje")
    data = dump(ch)
    data.pop("quiz", None)
    data["quiz_count"] = len(ch.quiz)
    return data


@router.get("/chapters/{chapter_id}/quiz")
def get_quiz(chapter_id: str) -> list[dict[str, Any]]:
    ch = get_store().chapter(chapter_id)
    if not ch:
        raise HTTPException(404, "Kapitola neexistuje")
    return [dump(q) for q in ch.quiz]


@router.get("/items")
def list_items(chapter: str | None = None, kind: str | None = None) -> list[dict[str, Any]]:
    store = get_store()
    out = []
    for ch in store.chapters:
        if chapter and ch.id != chapter:
            continue
        for it in ch.items:
            if kind and it.kind != kind:
                continue
            out.append(_item_brief(it, ch))
    return out


@router.get("/items/{item_id}")
def get_item(item_id: str) -> dict[str, Any]:
    store = get_store()
    item = store.items.get(item_id)
    if not item:
        raise HTTPException(404, "Položka neexistuje")
    ch = store.chapter_of(item_id)
    data = dump(item)
    data["chapter"] = {"id": ch.id, "number": ch.number, "title": ch.title}
    data["related_items"] = [
        _item_brief(store.items[r], store.chapter_of(r)) for r in item.related if r in store.items
    ]
    # items that reference this one (backlinks)
    data["referenced_by"] = [
        _item_brief(other, store.chapter_of(oid))
        for oid, other in store.items.items()
        if item_id in other.related and oid not in item.related
    ][:20]
    data["exam_questions"] = [q.number for q in store.exam if item_id in q.items]
    return data


@router.get("/search")
def search(q: str = Query(min_length=1, max_length=100), limit: int = Query(30, le=100)) -> list[dict[str, Any]]:
    return [
        {**_item_brief(h.item, h.chapter), "score": h.score, "statement": h.item.statement}
        for h in get_store().search(q, limit)
    ]


@router.get("/exam")
def exam_questions() -> list[dict[str, Any]]:
    store = get_store()
    out = []
    for q in store.exam:
        d = dump(q)
        d["item_details"] = [
            _item_brief(store.items[i], store.chapter_of(i)) for i in q.items if i in store.items
        ]
        out.append(d)
    return out


@router.get("/visualizations")
def visualizations() -> list[dict[str, Any]]:
    store = get_store()
    out = []
    for vid, title in VISUALIZATIONS.items():
        items = [
            _item_brief(it, store.chapter_of(it.id)) for it in store.items.values() if it.visualization == vid
        ]
        out.append({"id": vid, "title": title, "items": items})
    return out
