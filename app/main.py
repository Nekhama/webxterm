"""
webXTerm Main Application
FastAPI-based web terminal with SSH and Telnet support
"""

from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from .core.config import settings
from .api import api_router
from .core.database import init_db

# Initialize FastAPI app
app = FastAPI(
    title="webXTerm",
    description="Modern Web Terminal with SSH and Telnet support",
    version="1.0.0",
    docs_url="/api/docs" if settings.DEBUG else None,
    redoc_url="/api/redoc" if settings.DEBUG else None,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API 缓存控制中间件 - 防止浏览器缓存导致 API 延迟
@app.middleware("http")
async def add_cache_control(request: Request, call_next):
    """为 API 路径添加缓存控制头"""
    response = await call_next(request)
    
    # 为 /api/ 路径添加缓存控制头，防止浏览器缓存导致延迟
    if request.url.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
    
    return response

# Mount static files
app.mount("/static", StaticFiles(directory="frontend/static"), name="static")

# Include API router
app.include_router(api_router, prefix="/api")


@app.on_event("startup")
async def startup_event():
    """Initialize application on startup"""
    await init_db()
    print(f"webXTerm started on {settings.HOST}:{settings.PORT}")


@app.get("/")
async def root():
    """Serve main application page"""
    return FileResponse("frontend/index.html")

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "version": "1.0.0"}


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        log_level="info" if not settings.DEBUG else "debug",
    )
