from fastapi import APIRouter, Form, Request
from fastapi.responses import RedirectResponse, HTMLResponse
from fastapi.templating import Jinja2Templates

from app.schemas import Page, Button
from app.services.storage import load_pages, get_page, create_page, update_page, delete_page

router = APIRouter()
templates = Jinja2Templates(directory="app/templates")

VALID_THEMES = ["clinic-clean", "dark-modern"]
BUTTON_TYPES = ["whatsapp", "instagram", "maps", "website", "phone", "booking", "menu", "custom"]


@router.get("/dashboard", response_class=HTMLResponse)
def dashboard(request: Request):
    pages = load_pages()
    return templates.TemplateResponse(
        "dashboard.html",
        {"request": request, "pages": pages},
    )


@router.get("/dashboard/create", response_class=HTMLResponse)
def create_page_form(request: Request):
    return templates.TemplateResponse(
        "create_page.html",
        {
            "request": request,
            "themes": VALID_THEMES,
            "button_types": BUTTON_TYPES,
        },
    )


@router.post("/dashboard/create")
def create_page_submit(
    request: Request,
    name: str = Form(...),
    slug: str = Form(...),
    logo: str = Form(...),
    theme: str = Form(...),
    btn_title: list[str] = Form(default=[]),
    btn_url: list[str] = Form(default=[]),
    btn_type: list[str] = Form(default=[]),
):
    buttons = [
        Button(title=t, url=u, type=ty)
        for t, u, ty in zip(btn_title, btn_url, btn_type)
    ]

    try:
        create_page(Page(name=name, slug=slug, logo=logo, theme=theme, buttons=buttons))
    except ValueError as e:
        return templates.TemplateResponse(
            "create_page.html",
            {
                "request": request,
                "error": str(e),
                "themes": VALID_THEMES,
                "button_types": BUTTON_TYPES,
                "name": name,
                "slug": slug,
                "logo": logo,
                "theme": theme,
            },
        )

    return RedirectResponse(url="/dashboard", status_code=303)


@router.get("/dashboard/edit/{slug}", response_class=HTMLResponse)
def edit_page_form(request: Request, slug: str):
    page = get_page(slug)
    if not page:
        return HTMLResponse("Página não encontrada", status_code=404)
    return templates.TemplateResponse(
        "edit_page.html",
        {
            "request": request,
            "page": page,
            "themes": VALID_THEMES,
            "button_types": BUTTON_TYPES,
        },
    )


@router.post("/dashboard/edit/{slug}")
def edit_page_submit(
    request: Request,
    slug: str,
    name: str = Form(...),
    new_slug: str = Form(...),
    logo: str = Form(...),
    theme: str = Form(...),
    btn_title: list[str] = Form(default=[]),
    btn_url: list[str] = Form(default=[]),
    btn_type: list[str] = Form(default=[]),
):
    buttons = [
        Button(title=t, url=u, type=ty)
        for t, u, ty in zip(btn_title, btn_url, btn_type)
    ]

    updated = Page(name=name, slug=new_slug, logo=logo, theme=theme, buttons=buttons)

    try:
        result = update_page(slug, updated)
    except ValueError as e:
        page = get_page(slug)
        return templates.TemplateResponse(
            "edit_page.html",
            {
                "request": request,
                "page": page,
                "error": str(e),
                "themes": VALID_THEMES,
                "button_types": BUTTON_TYPES,
            },
        )

    if not result:
        return HTMLResponse("Página não encontrada", status_code=404)

    return RedirectResponse(url="/dashboard", status_code=303)


@router.post("/dashboard/delete/{slug}")
def delete_page_route(slug: str):
    if not delete_page(slug):
        return HTMLResponse("Página não encontrada", status_code=404)
    return RedirectResponse(url="/dashboard", status_code=303)
