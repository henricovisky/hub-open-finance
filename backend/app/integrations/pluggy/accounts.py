from typing import List, Optional
from app.integrations.pluggy.schemas import PluggyAccount, PluggyPage


class AccountsClient:
    def __init__(self, request_fn):
        self._request = request_fn

    async def list(self, item_id: str, account_type: Optional[str] = None) -> List[PluggyAccount]:
        """
        Lista contas vinculadas a um Item.
        Nota: Na API da Pluggy, itemId é obrigatório na consulta de contas.
        """
        params = {"itemId": item_id}
        if account_type:
            params["type"] = account_type

        data = await self._request("GET", "/accounts", params=params)
        page = PluggyPage[PluggyAccount].model_validate(data)
        return page.results

    async def get(self, account_id: str) -> PluggyAccount:
        """Obtém detalhes de uma conta específica."""
        data = await self._request("GET", f"/accounts/{account_id}")
        return PluggyAccount.model_validate(data)
