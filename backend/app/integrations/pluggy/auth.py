import asyncio
import time
from typing import Optional
import httpx
from app.integrations.pluggy.exceptions import PluggyAuthError


class PluggyAuthManager:
    """
    Gerencia a autenticação com a API Pluggy e o cache da API Key em memória.
    Validade documentada da API Key: 2 horas (7200 segundos).
    Renovação automática ~5 minutos antes da expiração (TTL de 6900 segundos).
    """

    def __init__(
        self,
        client_id: str,
        client_secret: str,
        base_url: str = "https://api.pluggy.ai",
        ttl_seconds: int = 6900,
    ):
        self.client_id = client_id
        self.client_secret = client_secret
        self.base_url = base_url.rstrip("/")
        self.ttl_seconds = ttl_seconds

        self._api_key: Optional[str] = None
        self._expires_at: float = 0.0
        self._lock = asyncio.Lock()

    def is_valid(self) -> bool:
        """Verifica se a chave atual ainda está dentro da janela de validade segura."""
        return self._api_key is not None and time.time() < self._expires_at

    def invalidate(self) -> None:
        """Invalida o cache local (usado quando a Pluggy responde 401)."""
        self._api_key = None
        self._expires_at = 0.0

    async def get_api_key(self, client: Optional[httpx.AsyncClient] = None) -> str:
        """
        Retorna uma API Key válida, reutilizando o cache existente ou
        solicitando uma nova via POST /auth de forma thread/coroutine-safe.
        """
        if self.is_valid():
            return self._api_key  # type: ignore

        async with self._lock:
            # Double-check pattern após adquirir o lock
            if self.is_valid():
                return self._api_key  # type: ignore

            new_key = await self._fetch_new_api_key(client)
            self._api_key = new_key
            self._expires_at = time.time() + self.ttl_seconds
            return self._api_key

    async def _fetch_new_api_key(self, client: Optional[httpx.AsyncClient] = None) -> str:
        if not self.client_id or not self.client_secret:
            raise PluggyAuthError("PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET são obrigatórios para autenticação.")

        payload = {"clientId": self.client_id, "clientSecret": self.client_secret}
        url = f"{self.base_url}/auth"

        try:
            if client is not None:
                resp = await client.post(url, json=payload, timeout=15.0)
            else:
                async with httpx.AsyncClient(timeout=15.0) as temp_client:
                    resp = await temp_client.post(url, json=payload)

            if resp.status_code != 200:
                raise PluggyAuthError(
                    f"Falha na autenticação Pluggy (HTTP {resp.status_code})",
                    status_code=resp.status_code,
                    response_body=resp.text,
                )

            data = resp.json()
            api_key = data.get("apiKey")
            if not api_key:
                raise PluggyAuthError("Resposta da Pluggy não continha 'apiKey'.", status_code=200)

            return api_key

        except httpx.RequestError as exc:
            raise PluggyAuthError(f"Erro de rede ao autenticar na Pluggy: {str(exc)}")
