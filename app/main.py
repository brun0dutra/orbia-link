from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

from app.routes import admin, public

app = FastAPI(title="Orbia Link", description="Gerador de páginas de links para empresas locais")
templates = Jinja2Templates(directory="app/templates")

# Mount static files
app.mount("/static", StaticFiles(directory="app/static"), name="static")


@app.get("/", response_class=HTMLResponse)
def root(request: Request):
    return templates.TemplateResponse("landing.html", {"request": request})


@app.get("/health")
def health():
    return {"status": "ok", "app": "Orbia Link"}


# Include routers (public router with catch-all /{slug} must be last)
app.include_router(admin.router)
app.include_router(public.router)
