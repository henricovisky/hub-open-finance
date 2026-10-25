from typing import List, Optional
from app.integrations.pluggy.schemas import PluggyBill, PluggyPage


class BillsClient:
    def __init__(self, request_fn):
        self._request = request_fn

    async def list(self, account_id: Optional[str] = None) -> List[PluggyBill]:
        """Consulta faturas de cartão de crédito disponíveis."""
        params = {}
        if account_id:
            params["accountId"] = account_id

        data = await self._request("GET", "/bills", params=params)
        page = PluggyPage[PluggyBill].model_validate(data)
        return page.results

    async def get(self, bill_id: str) -> PluggyBill:
        """Obtém detalhes de uma fatura específica."""
        data = await self._request("GET", f"/bills/{bill_id}")
        return PluggyBill.model_validate(data)
