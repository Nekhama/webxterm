"""
API router configuration
"""

from fastapi import APIRouter
from . import connections, sessions, ssh_keys

# Create main API router
api_router = APIRouter()

# Include sub-routers
api_router.include_router(
    connections.router,
    prefix="/connections",
    tags=["connections"]
)

api_router.include_router(
    sessions.router,
    prefix="/sessions",
    tags=["sessions"]
)

api_router.include_router(
    ssh_keys.router,
    prefix="/ssh-keys",
    tags=["ssh-keys"]
)
