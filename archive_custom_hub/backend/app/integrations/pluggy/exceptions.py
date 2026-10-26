from typing import Optional


class PluggyError(Exception):
    """Exceção base para erros de integração com a Pluggy."""
    def __init__(self, message: str, status_code: Optional[int] = None, response_body: Optional[str] = None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.response_body = response_body


class PluggyAuthError(PluggyError):
    """Erro de autenticação ou credenciais inválidas (401)."""
    pass


class PluggyPermissionError(PluggyError):
    """Erro de escopo ou permissão negada (403)."""
    pass


class PluggyNotFoundError(PluggyError):
    """Recurso solicitado não encontrado na Pluggy (404)."""
    pass


class PluggyRateLimitError(PluggyError):
    """Limite de requisições atingido (429)."""
    def __init__(self, message: str, retry_after: Optional[float] = None, **kwargs):
        super().__init__(message, status_code=429, **kwargs)
        self.retry_after = retry_after


class PluggyServerError(PluggyError):
    """Erro interno no servidor da Pluggy (5xx)."""
    pass


class PluggyTimeoutError(PluggyError):
    """Tempo limite de conexão ou leitura esgotado ao comunicar com a Pluggy."""
    pass
