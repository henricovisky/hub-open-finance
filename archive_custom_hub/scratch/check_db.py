import asyncio
import sys
import os

sys.path.insert(0, os.path.abspath("backend"))

from app.core.database import async_session_factory
from app.models.connection import FinancialConnection
from app.models.finance import Account, Transaction
from sqlalchemy import select

async def main():
    async with async_session_factory() as session:
        res = await session.execute(select(FinancialConnection))
        conns = res.scalars().all()
        print(f"Connections count: {len(conns)}")
        for c in conns:
            print(f"  Connection: {c.id} | {c.institution_name} | {c.pluggy_item_id} | {c.status}")

        res_acc = await session.execute(select(Account))
        accs = res_acc.scalars().all()
        print(f"Accounts count: {len(accs)}")
        for a in accs:
            print(f"  Account: {a.id} | {a.name} | {a.owner_context} | {a.type} | balance: {a.current_balance}")

        res_tx = await session.execute(select(Transaction))
        txs = res_tx.scalars().all()
        print(f"Transactions count: {len(txs)}")

if __name__ == "__main__":
    asyncio.run(main())
