from typing import Optional
from app.integrations.pluggy.schemas import PluggyConnectToken


class ConnectClient:
    def __init__(self, request_fn):
        self._request = request_fn

    async def create_token(
        self,
        item_id: Optional[str] = None,
        client_user_id: Optional[str] = None,
        webhook_url: Optional[str] = None,
    ) -> PluggyConnectToken:
        """
        Gera um Connect Token temporário (30 minutos) para uso seguro no widget.
        Conforme DTI §5.4, clientUserId e webhookUrl residem dentro de options.
        """
        payload: dict = {}
        if item_id:
            payload["itemId"] = item_id

        options: dict = {}
        if client_user_id:
            options["clientUserId"] = client_user_id
        if webhook_url:
            options["webhookUrl"] = webhook_url

        if options:
            payload["options"] = options

        data = await self._request("POST", "/connect_token", json=payload)
        return PluggyConnectToken.model_validate(data)
