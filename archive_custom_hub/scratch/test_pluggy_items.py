import asyncio
import sys
import os

sys.path.insert(0, os.path.abspath("backend"))

from app.core.config import settings
from app.integrations.pluggy import PluggyClient

async def main():
    print(f"Connecting to Pluggy with Client ID: {settings.PLUGGY_CLIENT_ID[:5]}... Base URL: {settings.PLUGGY_BASE_URL}")
    client = PluggyClient(
        client_id=settings.PLUGGY_CLIENT_ID,
        client_secret=settings.PLUGGY_CLIENT_SECRET,
        base_url=settings.PLUGGY_BASE_URL,
    )
    try:
        # Check without client_user_id
        items = await client.items.list()
        print(f"Items found in Pluggy account (total {len(items)}):")
        for it in items:
            conn_name = it.connector.name if it.connector else "N/A"
            conn_id = it.connector.id if it.connector else "N/A"
            print(f"  Item ID: {it.id} | Status: {it.status} | Connector: {conn_name} (ID: {conn_id}) | Created: {it.created_at}")

        # Check accounts for each item
        for it in items:
            print(f"\nFetching accounts for Item {it.id}:")
            accounts = await client.accounts.list(item_id=it.id)
            print(f"  Accounts found: {len(accounts)}")
            for acc in accounts:
                print(f"    Account: ID={acc.id} | Name={acc.name} | Type={acc.type} | Subtype={acc.subtype} | Balance={acc.balance} {acc.currency_code}")
    except Exception as e:
        print(f"Error querying Pluggy: {e}")
    finally:
        await client.close()

if __name__ == "__main__":
    asyncio.run(main())
