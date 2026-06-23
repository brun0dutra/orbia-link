from fastapi import APIRouter
from fastapi.responses import HTMLResponse

from app.services.storage import get_page

router = APIRouter()


@router.get("/{slug}", response_class=HTMLResponse)
def public_page(slug: str):
    page = get_page(slug)
    if not page:
        return HTMLResponse(
            "<h1>Página não encontrada</h1><p>Essa página não existe.</p>",
            status_code=404,
        )

    # Dynamically load the theme template
    theme_name = page.theme.replace("-", "_")
    html_path = f"app/templates/themes/theme_{theme_name}.html"

    try:
        with open(html_path, "r", encoding="utf-8") as f:
            template_content = f.read()
    except FileNotFoundError:
        # Fallback to dark-modern theme if template not found
        with open("app/templates/themes/theme_dark_modern.html", "r", encoding="utf-8") as f:
            template_content = f.read()

    # Build buttons HTML
    buttons_html = ""
    for btn in page.buttons:
        buttons_html += f"""
        <a href="{btn.url}" target="_blank" rel="noopener noreferrer" class="link-button link-button-{btn.type}">
            <span class="button-icon button-icon-{btn.type}"></span>
            <span class="button-text">{btn.title}</span>
        </a>
        """

    # Build page content
    logo_html = f'<img src="{page.logo}" alt="{page.name}" class="page-logo" />' if page.logo else ""

    html = template_content.replace("{{ NAME }}", page.name)
    html = html.replace("{{ LOGO }}", logo_html)
    html = html.replace("{{ BUTTONS }}", buttons_html)

    return HTMLResponse(content=html)
