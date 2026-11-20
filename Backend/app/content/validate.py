"""CLI: `python -m app.content.validate [content_dir]` – strict validation of the content."""

import sys
from pathlib import Path

from app.config import get_settings
from app.content.loader import ContentError, load_content


def main() -> int:
    content_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else get_settings().content_dir
    try:
        store = load_content(content_dir, strict=False)
    except ContentError as exc:
        print(f"ERROR: {exc}")
        return 1
    for w in store.warnings:
        print(f"WARNING: {w}")
    quiz = sum(len(c.quiz) for c in store.chapters)
    print(
        f"OK: {len(store.chapters)} chapters, {len(store.items)} items, "
        f"{quiz} quiz questions, {len(store.exam)} exam questions, {len(store.warnings)} warnings"
    )
    return 1 if store.warnings else 0


if __name__ == "__main__":
    sys.exit(main())
