from typing import AsyncGenerator
from app.core.config import settings
from app.integrations.pluggy import PluggyAuthManager, PluggyClient

_cached_auth_manager = None


def get_pluggy_auth_manager() -> PluggyAuthManager:
    global _cached_auth_manager
    client_id = settings.PLUGGY_CLIENT_ID or "dummy_client_id"
    client_secret = settings.PLUGGY_CLIENT_SECRET or "dummy_client_secret"

    if _cached_auth_manager is None or _cached_auth_manager.client_id != client_id:
        _cached_auth_manager = PluggyAuthManager(
            client_id=client_id,
            client_secret=client_secret,
            base_url=settings.PLUGGY_BASE_URL,
        )
    return _cached_auth_manager


async def get_pluggy_client() -> AsyncGenerator[PluggyClient, None]:
    """Injeção de dependência do cliente Pluggy assíncrono."""
    auth = get_pluggy_auth_manager()
    async with PluggyClient(
        client_id=auth.client_id,
        client_secret=auth.client_secret,
        base_url=settings.PLUGGY_BASE_URL,
        auth_manager=auth,
    ) as client:
        yield client
