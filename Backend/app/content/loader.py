"""Loads, validates and indexes the YAML study content."""

from __future__ import annotations

import logging
import re
import unicodedata
from dataclasses import dataclass, field
from pathlib import Path

import yaml

from app.content.models import (
    PROVABLE_KINDS,
    VISUALIZATIONS,
    Chapter,
    ExamFile,
    ExamQuestion,
    Item,
)

log = logging.getLogger(__name__)


class ContentError(Exception):
    pass


def normalize(text: str) -> str:
    """Lowercase and strip diacritics + LaTeX noise, for diacritics-insensitive search."""
    text = unicodedata.normalize("NFKD", text)
    text = "".join(c for c in text if not unicodedata.combining(c))
    text = re.sub(r"\\[a-zA-Z]+", " ", text)
    text = re.sub(r"[^\w\s-]", " ", text.lower())
    return re.sub(r"\s+", " ", text).strip()


@dataclass
class SearchHit:
    item: Item
    chapter: Chapter
    score: float


@dataclass
class ContentStore:
    chapters: list[Chapter] = field(default_factory=list)
    exam: list[ExamQuestion] = field(default_factory=list)
    items: dict[str, Item] = field(default_factory=dict)
    item_chapter: dict[str, str] = field(default_factory=dict)
    warnings: list[str] = field(default_factory=list)
    _index: list[tuple[str, str, str, str]] = field(default_factory=list)  # id, title, terms, body

    def chapter(self, chapter_id: str) -> Chapter | None:
        return next((c for c in self.chapters if c.id == chapter_id), None)

    def chapter_of(self, item_id: str) -> Chapter | None:
        cid = self.item_chapter.get(item_id)
        return self.chapter(cid) if cid else None

    def search(self, query: str, limit: int = 30) -> list[SearchHit]:
        q = normalize(query)
        if not q:
            return []
        words = q.split()
        hits: list[SearchHit] = []
        for item_id, title, terms, body in self._index:
            score = 0.0
            if q == title or f" {q} " in f" {terms} ":
                score += 100
            if title.startswith(q):
                score += 40
            for w in words:
                if w in title:
                    score += 12
                if w in terms:
                    score += 8
                if w in body:
                    score += 1
            if all(w in f"{title} {terms} {body}" for w in words) and score > 0:
                item = self.items[item_id]
                if item.kind == "definition":
                    score += 2  # prefer definitions for term look-ups
                hits.append(SearchHit(item, self.chapter_of(item_id), score))  # type: ignore[arg-type]
        hits.sort(key=lambda h: (-h.score, h.chapter.number, h.item.id))
        return hits[:limit]


def _load_yaml(path: Path):
    try:
        with path.open(encoding="utf-8") as fh:
            return yaml.safe_load(fh)
    except yaml.YAMLError as exc:
        raise ContentError(f"{path.name}: invalid YAML: {exc}") from exc


def load_content(content_dir: Path, strict: bool = False) -> ContentStore:
    store = ContentStore()
    chapter_dir = content_dir / "chapters"
    if not chapter_dir.is_dir():
        raise ContentError(f"Content directory {chapter_dir} does not exist")

    for path in sorted(chapter_dir.glob("*.yaml")):
        data = _load_yaml(path)
        try:
            chapter = Chapter.model_validate(data)
        except Exception as exc:
            raise ContentError(f"{path.name}: {exc}") from exc
        if store.chapter(chapter.id):
            raise ContentError(f"{path.name}: duplicate chapter id {chapter.id}")
        store.chapters.append(chapter)
        for item in chapter.items:
            if item.id in store.items:
                raise ContentError(
                    f"{path.name}: duplicate item id {item.id} "
                    f"(already in {store.item_chapter[item.id]})"
                )
            store.items[item.id] = item
            store.item_chapter[item.id] = chapter.id
    store.chapters.sort(key=lambda c: c.number)

    exam_path = content_dir / "exam.yaml"
    if exam_path.exists():
        try:
            store.exam = ExamFile.model_validate(_load_yaml(exam_path) or {}).questions
        except Exception as exc:
            raise ContentError(f"exam.yaml: {exc}") from exc
        store.exam.sort(key=lambda q: q.number)

    _check_references(store)
    if store.warnings:
        for w in store.warnings:
            log.warning("content: %s", w)
        if strict:
            raise ContentError("\n".join(store.warnings))

    for item_id, item in store.items.items():
        body = " ".join(
            filter(None, [item.statement, item.intuition, item.label, *(e.title or "" for e in item.examples)])
        )
        store._index.append(
            (item_id, normalize(item.title), normalize(" ".join(item.terms)), normalize(body))
        )
    log.info("Loaded %d chapters, %d items, %d exam questions", len(store.chapters), len(store.items), len(store.exam))
    return store


def _check_references(store: ContentStore) -> None:
    w = store.warnings
    quiz_ids: set[str] = set()
    for ch in store.chapters:
        section_numbers = {s.number for s in ch.sections}
        for item in ch.items:
            for ref in item.related:
                if ref not in store.items:
                    w.append(f"{ch.id}/{item.id}: related -> unknown id '{ref}'")
            if item.visualization and item.visualization not in VISUALIZATIONS:
                w.append(f"{ch.id}/{item.id}: unknown visualization '{item.visualization}'")
            if item.section and section_numbers and item.section not in section_numbers:
                w.append(f"{ch.id}/{item.id}: unknown section '{item.section}'")
            if item.kind in PROVABLE_KINDS and not item.proof:
                w.append(f"{ch.id}/{item.id}: {item.kind} without proof")
        for q in ch.quiz:
            if q.id in quiz_ids:
                w.append(f"{ch.id}: duplicate quiz id {q.id}")
            quiz_ids.add(q.id)
            for ref in q.related:
                if ref not in store.items:
                    w.append(f"{ch.id}/{q.id}: related -> unknown id '{ref}'")
    for q in store.exam:
        for cid in q.chapters:
            if not store.chapter(cid):
                w.append(f"exam {q.number}: unknown chapter '{cid}'")
        for ref in q.items:
            if ref not in store.items:
                w.append(f"exam {q.number}: unknown item '{ref}'")


_store: ContentStore | None = None


def get_store() -> ContentStore:
    global _store
    if _store is None:
        from app.config import get_settings

        s = get_settings()
        _store = load_content(s.content_dir, strict=s.strict_content)
    return _store
