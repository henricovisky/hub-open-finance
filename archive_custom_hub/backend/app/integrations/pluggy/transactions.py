from datetime import date
from typing import AsyncIterator, Optional, Union
from app.integrations.pluggy.schemas import PluggyTransaction, PluggyV2TransactionPage


class TransactionsClient:
    def __init__(self, request_fn):
        self._request = request_fn

    async def list(
        self,
        account_id: str,
        from_date: Optional[Union[date, str]] = None,
        to_date: Optional[Union[date, str]] = None,
        cursor: Optional[str] = None,
    ) -> PluggyV2TransactionPage:
        """
        Consulta transações paginadas por cursor de uma conta usando a API v2 da Pluggy.
        Endpoint documentado: GET /v2/transactions
        """
        params: dict = {
            "accountId": account_id,
        }
        if cursor:
            params["cursor"] = cursor
        if from_date:
            params["from"] = from_date.isoformat() if hasattr(from_date, "isoformat") else str(from_date)
        if to_date:
            params["to"] = to_date.isoformat() if hasattr(to_date, "isoformat") else str(to_date)

        data = await self._request("GET", "/v2/transactions", params=params)
        return PluggyV2TransactionPage.model_validate(data)

    async def iterate(
        self,
        account_id: str,
        from_date: Optional[Union[date, str]] = None,
        to_date: Optional[Union[date, str]] = None,
    ) -> AsyncIterator[PluggyTransaction]:
        """
        Iterador assíncrono que percorre todas as transações da conta utilizando
        paginação automática baseada em cursor (/v2/transactions).
        """
        cursor: Optional[str] = None
        while True:
            page = await self.list(
                account_id=account_id,
                from_date=from_date,
                to_date=to_date,
                cursor=cursor,
            )

            for tx in page.results:
                yield tx

            if not page.next or not page.results:
                break

            cursor = page.next
