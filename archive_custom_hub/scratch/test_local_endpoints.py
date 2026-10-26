import asyncio
import sys
import os

sys.path.insert(0, os.path.abspath("backend"))

from app.core.database import async_session_factory
from app.models.user import User
from app.models.finance import Transaction, Account
from sqlalchemy import select, func

async def main():
    async with async_session_factory() as session:
        # Check users
        users_res = await session.execute(select(User))
        users = users_res.scalars().all()
        print("Users in DB:")
        for u in users:
            print(f"  User: {u.id} | {u.email} | {u.name} | {u.role}")

        # Check transactions date range and contexts
        tx_stats = await session.execute(
            select(
                Transaction.context,
                Transaction.type,
                func.count(Transaction.id),
                func.min(Transaction.date),
                func.max(Transaction.date),
                func.sum(Transaction.amount),
            ).group_by(Transaction.context, Transaction.type)
        )
        print("\nTransactions stats by context and type:")
        for row in tx_stats.all():
            print(f"  Context: {row[0]} | Type: {row[1]} | Count: {row[2]} | Min Date: {row[3]} | Max Date: {row[4]} | Sum: {row[5]}")

        # Check latest 10 transactions
        latest_txs = await session.execute(
            select(Transaction).order_by(Transaction.date.desc()).limit(10)
        )
        print("\nLatest 10 transactions:")
        for t in latest_txs.scalars().all():
            print(f"  {t.date} | {t.description} | {t.amount} {t.currency} | Type: {t.type} | Context: {t.context}")

if __name__ == "__main__":
    asyncio.run(main())
