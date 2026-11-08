#!/usr/bin/env python3
"""
Script de Reset Completo do Banco de Dados.
Zera todas as transações, conexões, contas, faturas e investimentos.
Recria esquemas e adiciona apenas os usuários essenciais (ADMIN e MEMBER) e classes de ativos.
Zero mocks, zero sandbox data.
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

# Adiciona o diretório backend ao sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from sqlalchemy import text
from app.core.database import engine, async_session_factory
from app.core.init_db import init_db
from app.models.base import Base

TABLES_TO_CLEAR = [
    "wealth_snapshot_items",
    "wealth_snapshots",
    "investment_transactions",
    "investments",
    "credit_card_bills",
    "transactions",
    "cards",
    "financial_accounts",
    "connection_sync_runs",
    "sync_events",
    "account_permissions",
    "financial_connections",
    "goal_contributions",
    "goals",
    "recurring_rules",
    "user_preferences",
    "category_colors",
    "insight_states",
    "audit_logs",
    "user_sessions",
    "webhook_events",
    "categories",
    "users",
    "asset_classes",
]


async def reset_database():
    print("=== INICIANDO LIMPEZA TOTAL DO BANCO DE DADOS ===")

    # Se for SQLite, podemos remover as tabelas via drop_all
    # Se for Postgres, podemos truncar em cascata
    async with engine.begin() as conn:
        print("[1/3] Removendo todas as tabelas existentes...")
        await conn.run_sync(Base.metadata.drop_all)
        print("      Tabelas removidas com sucesso.")

    print("\n[2/3] Recriando tabelas e inserindo dados estruturais limpos...")
    await init_db()
    print("      Esquemas recriados e usuários base criados.")

    print("\n[3/3] Verificando integridade das tabelas limpas:")
    async with async_session_factory() as session:
        for t in ["financial_connections", "financial_accounts", "transactions", "investments", "credit_card_bills", "users", "asset_classes"]:
            try:
                res = await session.execute(text(f"SELECT count(*) FROM {t}"))
                cnt = res.scalar()
                print(f"      - {t}: {cnt} registros")
            except Exception as e:
                print(f"      - {t}: {e}")

    await engine.dispose()
    print("\n✅ BANCO ZERADO COM SUCESSO! Pronto para novas integrações reais.")


if __name__ == "__main__":
    asyncio.run(reset_database())
