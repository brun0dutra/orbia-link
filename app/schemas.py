from pydantic import BaseModel
from typing import Optional


class Button(BaseModel):
    title: str
    url: str
    type: str  # whatsapp, instagram, maps, website, phone, booking, menu, custom


class Page(BaseModel):
    name: str
    slug: str
    logo: str
    theme: str  # clinic-clean, dark-modern
    buttons: list[Button]


class PageUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    logo: Optional[str] = None
    theme: Optional[str] = None
    buttons: Optional[list[Button]] = None
