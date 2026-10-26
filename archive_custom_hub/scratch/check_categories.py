import asyncio
import sys
import os

sys.path.insert(0, os.path.abspath("backend"))

from app.core.database import async_session_factory
from app.models.finance import Transaction, Category
from sqlalchemy import select, func

async def main():
    async with async_session_factory() as session:
        c_count = await session.execute(select(func.count(Category.id)))
        print('Total categories:', c_count.scalar())
        
        tx_cat_null = await session.execute(select(func.count(Transaction.id)).where(Transaction.category_id.is_(None)))
        print('Transactions with category_id IS NULL:', tx_cat_null.scalar())

        tx_sample = await session.execute(select(Transaction.provider_category).distinct().limit(10))
        print('Sample provider categories:', [r[0] for r in tx_sample.all()])

if __name__ == "__main__":
    asyncio.run(main())
