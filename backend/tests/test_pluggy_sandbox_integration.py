import os
from pathlib import Path
import pytest
from app.integrations.pluggy.client import PluggyClient


def get_sandbox_creds():
    client_id = os.getenv("PLUGGY_CLIENT_ID")
    client_secret = os.getenv("PLUGGY_CLIENT_SECRET")

    for p in [Path("secret.txt"), Path("../secret.txt"), Path("backend/.env"), Path(".env")]:
        if (not client_id or not client_secret) and p.exists():
            for line in p.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if line.startswith("pluggy_id=") or line.startswith("PLUGGY_CLIENT_ID="):
                    client_id = line.split("=", 1)[1].strip().strip('"').strip("'")
                elif line.startswith("pluggy_secret=") or line.startswith("PLUGGY_CLIENT_SECRET="):
                    client_secret = line.split("=", 1)[1].strip().strip('"').strip("'")
    return client_id, client_secret


@pytest.mark.asyncio
async def test_live_pluggy_sandbox_integration():
    """Teste de integração real com a API da Pluggy no Sandbox."""
    client_id, client_secret = get_sandbox_creds()
    if not client_id or not client_secret:
        pytest.skip("Credenciais Pluggy não encontradas para teste de integração ao vivo.")

    async with PluggyClient(client_id=client_id, client_secret=client_secret) as client:
        # 1. Obter API Key válida do gerenciador de autenticação
        api_key = await client.auth.get_api_key()
        assert api_key is not None
        assert len(api_key) > 20

        # 2. Emitir Connect Token para usuário de teste
        token_resp = await client.connect.create_token(client_user_id="test-integration-user")
        assert token_resp.connect_token is not None
        assert len(token_resp.connect_token) > 20

        # 3. Consultar Item ativo no Sandbox (GET /items/{id})
        sandbox_item_id = "a533f2fa-fad1-46e4-bdf1-2cd2188ebfc2"
        item = await client.items.get(sandbox_item_id)
        assert item.id == sandbox_item_id
        assert item.status in ["UPDATED", "UPDATING", "COMPLETED"]

        # 4. Listar contas do Item (GET /accounts?itemId={id})
        accounts = await client.accounts.list(item_id=item.id)
        assert isinstance(accounts, list)
        assert len(accounts) > 0
        assert accounts[0].id is not None
        assert accounts[0].type in ["BANK", "CREDIT"]

        # 5. Listar transações via v2 com cursor (GET /v2/transactions?accountId={id})
        first_acc_id = accounts[0].id
        tx_page = await client.transactions.list(account_id=first_acc_id)
        assert isinstance(tx_page.results, list)
        assert len(tx_page.results) > 0
        assert tx_page.results[0].id is not None
        assert tx_page.results[0].amount is not None
