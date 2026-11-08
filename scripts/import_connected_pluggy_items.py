#!/usr/bin/env python3
"""
Script utilitário para importar e sincronizar Items já conectados na Pluggy (Etapa 9/10).
Uso:
    python scripts/import_connected_pluggy_items.py <pluggy_item_id_1> <pluggy_item_id_2> ...
"""

import asyncio
import os
import sys
from pathlib import Path

# Ajusta path para importar módulos do backend
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

# Garante suporte a UTF-8 em consoles Windows
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

from sqlalchemy import select
from app.core.database import async_session_factory
from app.core.pluggy import get_pluggy_auth_manager
from app.integrations.pluggy import PluggyClient
from app.models.connection import ConnectionStatus, FinancialConnection, SyncTrigger
from app.models.user import User, UserRole
from app.services.sync_service import SyncService


async def import_items(item_ids):
    if not item_ids:
        print("[!] Nenhum item_id informado.")
        print("    Exemplo de uso: python scripts/import_connected_pluggy_items.py 3679c5a2-fad1-46e4-bdf1-2cd2188ebfc2")
        return

    print(f"[*] Iniciando importação e sincronização de {len(item_ids)} item(s) da Pluggy...")

    auth = get_pluggy_auth_manager()
    async with PluggyClient(client_id=auth.client_id, client_secret=auth.client_secret, auth_manager=auth) as client:
        async with async_session_factory() as db:
            # Localiza o usuário ADMIN
            admin_stmt = select(User).where(User.role == UserRole.ADMIN, User.is_active == True)
            admin = (await db.execute(admin_stmt)).scalars().first()

            if not admin:
                print("[!] Erro: Nenhum usuário Administrador encontrado no banco de dados.")
                print("    Execute primeiro: python scripts/create_initial_users.py")
                return

            print(f"[+] Administrador identificado: {admin.name} ({admin.email})")

            for item_id in item_ids:
                item_id = item_id.strip()
                print(f"\n---> Processando Item ID: {item_id}")

                try:
                    # 1. Consulta detalhes na Pluggy
                    pluggy_item = await client.items.get(item_id)
                    inst_name = pluggy_item.connector.name if pluggy_item.connector else f"Instituição #{pluggy_item.connector_id}"
                    print(f"   [+] Conector: {inst_name} | Status: {pluggy_item.status}")

                    # 2. Verifica se a conexão já existe no banco
                    conn_stmt = select(FinancialConnection).where(FinancialConnection.pluggy_item_id == item_id)
                    conn = (await db.execute(conn_stmt)).scalar_one_or_none()

                    if not conn:
                        conn = FinancialConnection(
                            owner_user_id=admin.id,
                            pluggy_item_id=item_id,
                            connector_id=pluggy_item.connector_id,
                            institution_name=inst_name,
                            status=ConnectionStatus.CONNECTED,
                            raw_status=pluggy_item.status,
                        )
                        db.add(conn)
                        await db.commit()
                        await db.refresh(conn)
                        print(f"   [+] Nova conexão criada no banco: ID {conn.id}")
                    else:
                        print(f"   [i] Conexão já existente no banco: ID {conn.id}")

                    # 3. Dispara sincronização completa
                    print("   [*] Executando sincronização de contas, transações, faturas e investimentos...")
                    run = await SyncService.sync_connection(
                        db=db,
                        connection_id=conn.id,
                        client=client,
                        trigger=SyncTrigger.MANUAL,
                    )
                    print(f"   [OK] Sincronização concluída com status: {run.status}")
                    print(f"        Lidos: {run.records_read} | Inseridos: {run.records_inserted} | Atualizados: {run.records_updated}")

                except Exception as exc:
                    print(f"   [!] Falha ao processar item {item_id}: {exc}")

    print("\n[OK] Processamento finalizado! Acesse a interface web em http://localhost:8000 para visualizar o Dashboard.")


if __name__ == "__main__":
    ids = sys.argv[1:]
    asyncio.run(import_items(ids))
