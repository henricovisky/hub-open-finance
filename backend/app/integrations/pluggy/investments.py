from typing import Any, Dict, List, Optional
from app.integrations.pluggy.schemas import PluggyInvestment, PluggyPage


class InvestmentsClient:
    def __init__(self, request_fn):
        self._request = request_fn

    async def list(self, item_id: Optional[str] = None) -> List[PluggyInvestment]:
        """Consulta posições de investimento disponíveis."""
        params = {}
        if item_id:
            params["itemId"] = item_id

        data = await self._request("GET", "/investments", params=params)
        page = PluggyPage[PluggyInvestment].model_validate(data)
        return page.results

    async def get(self, investment_id: str) -> PluggyInvestment:
        """Obtém detalhes de uma posição de investimento específica."""
        data = await self._request("GET", f"/investments/{investment_id}")
        return PluggyInvestment.model_validate(data)

    async def list_transactions(self, investment_id: str) -> List[Dict[str, Any]]:
        """Consulta operações/movimentações de um investimento."""
        data = await self._request("GET", f"/investments/{investment_id}/transactions")
        if isinstance(data, dict) and "results" in data:
            return data["results"]
        return data if isinstance(data, list) else []
