from fastapi import APIRouter
from app.api.v1 import (
    accounts,
    admin,
    auth,
    bills,
    cards,
    cashflow,
    categories,
    connections,
    dashboard,
    health,
    investments,
    transactions,
    wealth,
    webhooks,
)

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(auth.router)
api_router.include_router(admin.router)
api_router.include_router(connections.router)
api_router.include_router(accounts.router)
api_router.include_router(transactions.router)
api_router.include_router(bills.router)
api_router.include_router(cards.router)
api_router.include_router(investments.router)
api_router.include_router(wealth.router)
api_router.include_router(categories.router)
api_router.include_router(cashflow.router)
api_router.include_router(dashboard.router)
api_router.include_router(webhooks.router)
