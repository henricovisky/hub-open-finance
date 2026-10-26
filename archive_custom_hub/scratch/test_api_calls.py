import asyncio
import sys
import os

sys.path.insert(0, os.path.abspath("backend"))

from app.core.database import async_session_factory
from app.models.user import User, UserRole
from app.api.v1.dashboard import get_dashboard_overview
from app.api.v1.cashflow import get_cashflow_series
from app.api.v1.categories import get_categories_summary
from sqlalchemy import select

async def main():
    async with async_session_factory() as session:
        user_res = await session.execute(select(User).where(User.role == UserRole.ADMIN))
        admin = user_res.scalar_one()

        print("Testing dashboard overview for ADMIN (context=None):")
        ov = await get_dashboard_overview(context=None, current_user=admin, db=session)
        print(f"  liquid_balance: {ov.liquid_balance}")
        print(f"  monthly_income: {ov.monthly_income}")
        print(f"  monthly_expenses: {ov.monthly_expenses}")
        print(f"  monthly_net: {ov.monthly_net}")

        print("\nTesting cashflow series for ADMIN (context=None):")
        cf = await get_cashflow_series(context=None, current_user=admin, db=session)
        print(f"  cf totals: {cf['data']['totals']}")
        print(f"  cf points count: {len(cf['data']['points'])}")

        print("\nTesting categories summary for ADMIN (context=None):")
        cats = await get_categories_summary(context=None, current_user=admin, db=session)
        print(f"  categories count: {len(cats)}")

if __name__ == "__main__":
    asyncio.run(main())
