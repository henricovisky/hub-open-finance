import asyncio
import logging
import random
import time
from typing import Any, Dict, Optional
import httpx
from app.integrations.pluggy.accounts import AccountsClient
from app.integrations.pluggy.auth import PluggyAuthManager
from app.integrations.pluggy.bills import BillsClient
from app.integrations.pluggy.connect import ConnectClient
from app.integrations.pluggy.exceptions import (
    PluggyAuthError,
    PluggyError,
    PluggyNotFoundError,
    PluggyPermissionError,
    PluggyRateLimitError,
    PluggyServerError,
    PluggyTimeoutError,
)
from app.integrations.pluggy.investments import InvestmentsClient
from app.integrations.pluggy.items import ItemsClient
from app.integrations.pluggy.transactions import TransactionsClient

logger = logging.getLogger(__name__)


class PluggyClient:
    """
    Cliente HTTP assíncrono para comunicação com a API da Pluggy.
    Implementa:
    - Autenticação e cache de API Key (2h)
    - Renovação automática em 401 (repetição única)
    - Retry com backoff exponencial para erros 5xx transitórios
    - Respeito a Rate Limit (429 e Retry-After)
    - Sanitização total de dados sensíveis e credenciais em logs
    """

    def __init__(
        self,
        client_id: str,
        client_secret: str,
        base_url: str = "https://api.pluggy.ai",
        auth_manager: Optional[PluggyAuthManager] = None,
        http_client: Optional[httpx.AsyncClient] = None,
        max_retries: int = 3,
    ):
        self.base_url = base_url.rstrip("/")
        self.max_retries = max_retries

        self.auth = auth_manager or PluggyAuthManager(
            client_id=client_id,
            client_secret=client_secret,
            base_url=self.base_url,
        )

        timeout = httpx.Timeout(connect=10.0, read=30.0, write=10.0, pool=10.0)
        self._client = http_client or httpx.AsyncClient(
            base_url=self.base_url,
            timeout=timeout,
        )
        self._owns_client = http_client is None

        # Subclientes de recursos
        self.items = ItemsClient(self.request)
        self.accounts = AccountsClient(self.request)
        self.transactions = TransactionsClient(self.request)
        self.bills = BillsClient(self.request)
        self.investments = InvestmentsClient(self.request)
        self.connect = ConnectClient(self.request)

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.close()

    async def close(self):
        if self._owns_client and not self._client.is_closed:
            await self._client.aclose()

    async def request(
        self,
        method: str,
        path: str,
        params: Optional[Dict[str, Any]] = None,
        json: Optional[Dict[str, Any]] = None,
        retry_on_401: bool = True,
        attempt: int = 1,
    ) -> Any:
        """
        Executa requisição HTTP autenticada à Pluggy com políticas de resiliência.
        """
        api_key = await self.auth.get_api_key(self._client)
        headers = {
            "X-API-KEY": api_key,
            "Accept": "application/json",
            "Content-Type": "application/json",
        }

        url = f"{self.base_url}/{path.lstrip('/')}"
        log_endpoint = f"{method.upper()} {path}"
        start_time = time.time()

        try:
            resp = await self._client.request(
                method=method,
                url=url,
                params=params,
                json=json,
                headers=headers,
            )
            duration_ms = int((time.time() - start_time) * 1000)
            logger.info("Pluggy request: %s - Status %s (%dms)", log_endpoint, resp.status_code, duration_ms)

        except httpx.TimeoutException as exc:
            duration_ms = int((time.time() - start_time) * 1000)
            logger.warning("Pluggy timeout: %s (%dms)", log_endpoint, duration_ms)
            if method.upper() == "GET" and attempt < self.max_retries:
                await self._backoff_sleep(attempt)
                return await self.request(method, path, params, json, retry_on_401, attempt + 1)
            raise PluggyTimeoutError(f"Timeout ao chamar {log_endpoint}") from exc

        except httpx.RequestError as exc:
            raise PluggyError(f"Erro de conexão com a Pluggy ao chamar {log_endpoint}: {str(exc)}") from exc

        # Tratamento de status codes
        if resp.status_code in (200, 201, 204):
            if resp.status_code == 204 or not resp.content:
                return {}
            return resp.json()

        if resp.status_code == 401:
            if retry_on_401:
                logger.warning("Pluggy 401 Unauthorized recebido. Invalidando API Key e repetindo uma única vez...")
                self.auth.invalidate()
                return await self.request(method, path, params, json, retry_on_401=False, attempt=attempt)
            raise PluggyAuthError(f"Autenticação recusada pela Pluggy: {resp.text}", status_code=401)

        if resp.status_code == 403:
            logger.error("Pluggy 403 Forbidden para %s", log_endpoint)
            raise PluggyPermissionError(f"Permissão negada pela Pluggy: {resp.text}", status_code=403)

        if resp.status_code == 404:
            raise PluggyNotFoundError(f"Recurso não encontrado na Pluggy: {log_endpoint}", status_code=404)

        if resp.status_code == 429:
            retry_after_header = resp.headers.get("Retry-After")
            retry_after = float(retry_after_header) if retry_after_header and retry_after_header.isdigit() else 2.0
            logger.warning("Pluggy 429 Rate Limit atingido em %s. Retry-After: %s s", log_endpoint, retry_after)
            if attempt < self.max_retries and retry_after <= 5.0:
                await asyncio.sleep(retry_after)
                return await self.request(method, path, params, json, retry_on_401, attempt + 1)
            raise PluggyRateLimitError("Limite de requisições Pluggy atingido", retry_after=retry_after)

        if resp.status_code >= 500:
            logger.warning("Pluggy erro servidor (%s): %s", resp.status_code, log_endpoint)
            if attempt < self.max_retries:
                await self._backoff_sleep(attempt)
                return await self.request(method, path, params, json, retry_on_401, attempt + 1)
            raise PluggyServerError(
                f"Erro interno do servidor Pluggy (HTTP {resp.status_code}): {resp.text}",
                status_code=resp.status_code,
            )

        raise PluggyError(
            f"Erro na requisição Pluggy ({resp.status_code}): {resp.text}",
            status_code=resp.status_code,
            response_body=resp.text,
        )

    async def _backoff_sleep(self, attempt: int) -> None:
        """Backoff exponencial com jitter aleatório para evitar colisão de retries."""
        base_delay = 0.5 * (2 ** (attempt - 1))
        jitter = random.uniform(0.1, 0.3)
        delay = base_delay + jitter
        await asyncio.sleep(delay)
