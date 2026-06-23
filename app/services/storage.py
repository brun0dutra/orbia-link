import json
import os
import re
from typing import Optional

from app.schemas import Page


def slugify(text: str) -> str:
    """Convert text to a URL-friendly slug."""
    text = text.lower()
    text = re.sub(r"[àáâãäå]", "a", text)
    text = re.sub(r"[èéêë]", "e", text)
    text = re.sub(r"[ìíîï]", "i", text)
    text = re.sub(r"[òóôõö]", "o", text)
    text = re.sub(r"[ùúûü]", "u", text)
    text = re.sub(r"[ñ]", "n", text)
    text = re.sub(r"[ç]", "c", text)
    text = re.sub(r"[^a-z0-9\-]", "-", text)
    text = re.sub(r"-+", "-", text)
    text = text.strip("-")
    return text if text else "pagina"

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "data")
DATA_FILE = os.path.join(DATA_DIR, "pages.json")


def _ensure_data_file():
    os.makedirs(DATA_DIR, exist_ok=True)
    if not os.path.exists(DATA_FILE):
        with open(DATA_FILE, "w", encoding="utf-8") as f:
            json.dump([], f)


def load_pages() -> list[Page]:
    _ensure_data_file()
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)
    return [Page(**item) for item in data]


def save_pages(pages: list[Page]):
    _ensure_data_file()
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(
            [page.model_dump() for page in pages],
            f,
            indent=2,
            ensure_ascii=False,
        )


def get_page(slug: str) -> Optional[Page]:
    pages = load_pages()
    for page in pages:
        if page.slug == slug:
            return page
    return None


def create_page(page: Page) -> Page:
    pages = load_pages()
    page.slug = slugify(page.slug)
    if not page.slug:
        raise ValueError("Slug inválido")
    if any(p.slug == page.slug for p in pages):
        raise ValueError(f"Slug '{page.slug}' já está em uso")
    pages.append(page)
    save_pages(pages)
    return page


def update_page(slug: str, updated: Page) -> Optional[Page]:
    pages = load_pages()
    updated.slug = slugify(updated.slug)
    if not updated.slug:
        raise ValueError("Slug inválido")
    for i, page in enumerate(pages):
        if page.slug == slug:
            # If slug is being changed, check for conflicts
            if updated.slug != slug and any(p.slug == updated.slug for p in pages if p.slug != slug):
                raise ValueError(f"Slug '{updated.slug}' já está em uso")
            pages[i] = updated
            save_pages(pages)
            return updated
    return None


def delete_page(slug: str) -> bool:
    pages = load_pages()
    new_pages = [p for p in pages if p.slug != slug]
    if len(new_pages) == len(pages):
        return False
    save_pages(new_pages)
    return True
