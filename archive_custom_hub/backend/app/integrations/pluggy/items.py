from typing import Any, Dict, List, Optional
from app.integrations.pluggy.schemas import PluggyItem, PluggyPage


class ItemsClient:
    def __init__(self, request_fn):
        self._request = request_fn

    async def get(self, item_id: str) -> PluggyItem:
        """Obtém detalhes e status de um Item específico."""
        data = await self._request("GET", f"/items/{item_id}")
        return PluggyItem.model_validate(data)

    async def list(self, client_user_id: Optional[str] = None) -> List[PluggyItem]:
        """Lista Items associados ao cliente."""
        params = {}
        if client_user_id:
            params["clientUserId"] = client_user_id
        data = await self._request("GET", "/items", params=params)
        page = PluggyPage[PluggyItem].model_validate(data)
        return page.results

    async def create(self, connector_id: int, parameters: Dict[str, Any], client_user_id: Optional[str] = None) -> PluggyItem:
        """Cria um Item no Sandbox ou via parâmetros diretos."""
        payload: Dict[str, Any] = {
            "connectorId": connector_id,
            "parameters": parameters,
        }
        if client_user_id:
            payload["clientUserId"] = client_user_id
        data = await self._request("POST", "/items", json=payload)
        return PluggyItem.model_validate(data)

    async def delete(self, item_id: str) -> None:
        """Remove e desconecta um Item da Pluggy."""
        await self._request("DELETE", f"/items/{item_id}")
