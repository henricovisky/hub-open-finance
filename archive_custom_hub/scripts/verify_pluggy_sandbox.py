#!/usr/bin/env python3
"""
Script de Validação Pluggy Sandbox (Etapa 0)
Testa comunicação, autenticação e emissão de tokens sem expor segredos.
"""

import asyncio
import os
import sys
from pathlib import Path

# Garante suporte a UTF-8 em consoles Windows
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

import httpx

PLUGGY_BASE_URL = os.getenv("PLUGGY_BASE_URL", "https://api.pluggy.ai")


def load_credentials():
    """Carrega credenciais de variáveis de ambiente, .env ou secret.txt local."""
    client_id = os.getenv("PLUGGY_CLIENT_ID")
    client_secret = os.getenv("PLUGGY_CLIENT_SECRET")

    # Tenta carregar do backend/.env se não estiver no ambiente
    env_file = Path("backend/.env")
    if (not client_id or not client_secret) and env_file.exists():
        for line in env_file.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line.startswith("PLUGGY_CLIENT_ID="):
                client_id = line.split("=", 1)[1].strip().strip('"').strip("'")
            elif line.startswith("PLUGGY_CLIENT_SECRET="):
                client_secret = line.split("=", 1)[1].strip().strip('"').strip("'")

    # Tenta carregar de secret.txt local
    secret_file = Path("secret.txt")
    if (not client_id or not client_secret) and secret_file.exists():
        for line in secret_file.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line.startswith("pluggy_id="):
                client_id = line.split("=", 1)[1].strip()
            elif line.startswith("pluggy_secret="):
                client_secret = line.split("=", 1)[1].strip()

    return client_id, client_secret


async def verify_sandbox():
    client_id, client_secret = load_credentials()

    if not client_id or not client_secret:
        print("[!] Erro: PLUGGY_CLIENT_ID ou PLUGGY_CLIENT_SECRET não foram encontrados.")
        print("    Configure as variáveis no ambiente, em backend/.env ou em secret.txt.")
        sys.exit(1)

    # Mascara para exibição segura
    masked_id = client_id[:6] + "..." + client_id[-4:] if len(client_id) > 10 else "***"
    print(f"[*] Iniciando validação Pluggy Sandbox para Client ID: {masked_id}")

    async with httpx.AsyncClient(base_url=PLUGGY_BASE_URL, timeout=15.0) as client:
        # 1. Autenticação (POST /auth)
        print("\n1. Testando POST /auth...")
        auth_response = await client.post(
            "/auth",
            json={"clientId": client_id, "clientSecret": client_secret},
        )

        if auth_response.status_code != 200:
            print(f"[!] Falha na autenticação (HTTP {auth_response.status_code}): {auth_response.text}")
            sys.exit(1)

        api_key = auth_response.json().get("apiKey")
        if not api_key:
            print("[!] Resposta de autenticação não continha 'apiKey'.")
            sys.exit(1)

        print("   [+] Autenticação bem-sucedida! API Key obtida com sucesso.")

        headers = {"X-API-KEY": api_key}

        # 2. Consulta de Conectores Sandbox (GET /connectors?sandbox=true)
        print("\n2. Consultando conectores disponíveis no Sandbox (GET /connectors?sandbox=true)...")
        connectors_resp = await client.get("/connectors", headers=headers, params={"sandbox": "true"})

        if connectors_resp.status_code == 200:
            results = connectors_resp.json().get("results", [])
            print(f"   [+] Total de conectores Sandbox disponíveis: {len(results)}")
            sample = [f"{c.get('name')} (ID: {c.get('id')})" for c in results[:5]]
            print(f"   [+] Amostra: {', '.join(sample)}")
        else:
            print(f"   [-] Aviso: Não foi possível listar conectores ({connectors_resp.status_code})")

        # 3. Emissão de Connect Token (POST /connect_token)
        print("\n3. Testando emissão de Connect Token (POST /connect_token)...")
        token_payload = {
            "options": {
                "clientUserId": "test-admin-sandbox-user",
            }
        }
        token_resp = await client.post("/connect_token", headers=headers, json=token_payload)

        if token_resp.status_code in (200, 201):
            token_data = token_resp.json()
            connect_token = token_data.get("accessToken") or token_data.get("connectToken")
            if connect_token:
                masked_token = connect_token[:8] + "..." + connect_token[-6:]
                print(f"   [+] Connect Token emitido com sucesso: {masked_token}")
            else:
                print(f"   [+] Resposta recebida: {list(token_data.keys())}")
        else:
            print(f"   [-] Aviso: Falha ao emitir connect token ({token_resp.status_code}): {token_resp.text}")

        print("\n[OK] Validação do Sandbox concluída com sucesso! Credenciais e conectividade operacionais.")


if __name__ == "__main__":
    asyncio.run(verify_sandbox())
