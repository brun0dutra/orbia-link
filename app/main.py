from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse

from app.routes import admin, public

app = FastAPI(title="Orbia Link", description="Gerador de páginas de links para empresas locais")

# Mount static files
app.mount("/static", StaticFiles(directory="app/static"), name="static")


@app.get("/")
def root():
    return RedirectResponse(url="/dashboard")


@app.get("/health")
def health():
    return {"status": "ok", "app": "Orbia Link"}


# Include routers (public router with catch-all /{slug} must be last)
app.include_router(admin.router)
app.include_router(public.router)
