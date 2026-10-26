import asyncio
import sys
import os

sys.path.insert(0, os.path.abspath("backend"))

from app.core.database import async_session_factory
from app.models.finance import Transaction
from sqlalchemy import select, func

async def main():
    async with async_session_factory() as session:
        cats = await session.execute(
            select(Transaction.provider_category, func.count(Transaction.id), func.sum(Transaction.amount))
            .group_by(Transaction.provider_category)
            .order_by(func.count(Transaction.id).desc())
        )
        print("Provider categories in DB:")
        for c in cats.all():
            print(f"  Category: '{c[0]}' | Count: {c[1]} | Sum: {c[2]}")

if __name__ == "__main__":
    asyncio.run(main())
