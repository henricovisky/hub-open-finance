from fastapi import APIRouter
from app.api.v1 import accounts, admin, auth, connections, health, transactions

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(auth.router)
api_router.include_router(admin.router)
api_router.include_router(connections.router)
api_router.include_router(accounts.router)
api_router.include_router(transactions.router)
