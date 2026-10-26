"""
Script auxiliar para exibir credenciais e instruções de configuração
do Actual Budget com a Pluggy.ai (Open Finance).
"""

import os
from pathlib import Path

ENV_PATH = Path(__file__).resolve().parent.parent / ".env"

def main():
    print("=" * 65)
    print("      CONFIGURAÇÃO DO ACTUAL BUDGET COM PLUGGY.AI (OPEN FINANCE)")
    print("=" * 65)

    client_id = "ddf0ef0a-e904-418d-82e9-df338aeabd82"
    client_secret = "NC60tb6G23zxTO4G8lTcvmy9uBw6Fhpld6YFgIyU0CE"
    item_rico = "a5c3ae09-e773-4559-8518-94bb13f8711e"
    item_itau = "a5308e50-afe0-4e95-a934-558f8bcfe480"
    item_nubank = "6ca9e4da-dfac-48e7-b63a-7994650ac982"

    if ENV_PATH.exists():
        with open(ENV_PATH, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line.startswith("PLUGGY_CLIENT_ID="):
                    client_id = line.split("=", 1)[1]
                elif line.startswith("PLUGGY_CLIENT_SECRET="):
                    client_secret = line.split("=", 1)[1]
                elif line.startswith("PLUGGY_ITEM_XP_RICO="):
                    item_rico = line.split("=", 1)[1]
                elif line.startswith("PLUGGY_ITEM_ITAU="):
                    item_itau = line.split("=", 1)[1]
                elif line.startswith("PLUGGY_ITEM_NUBANK="):
                    item_nubank = line.split("=", 1)[1]

    print("\n[1] CREDENCIAIS DA API PLUGGY:")
    print(f"  • CLIENT_ID:     {client_id}")
    print(f"  • CLIENT_SECRET: {client_secret}")

    print("\n[2] CONEXÕES BANCÁRIAS JÁ VINCULADAS (ITEM IDs):")
    print(f"  • XP / Rico (Conta + Cartão Visa Infinite + Investimentos):")
    print(f"    Item ID: {item_rico}")
    print(f"  • Itaú Unibanco (Conta Corrente + Poupança + CDBs):")
    print(f"    Item ID: {item_itau}")
    print(f"  • Nubank (Conta Conjunta/Casal + Cartão Platinum):")
    print(f"    Item ID: {item_nubank}")

    print("\n[3] PASSO A PASSO NO NAVEGADOR:")
    print("  1. Inicie o servidor: docker compose up -d")
    print("  2. Acesse: http://localhost:5006")
    print("  3. Defina sua senha inicial e crie seu arquivo de orçamento.")
    print("  4. Vá em 'Settings' -> 'Advanced Settings' -> 'Experimental Features'.")
    print("  5. Ative a opção 'Pluggy.ai Bank Sync'.")
    print("  6. Clique em '+ Add Account' -> 'Set up bank sync' -> 'Pluggy.ai'.")
    print("  7. Cole o CLIENT_ID e CLIENT_SECRET acima.")
    print("  8. Cole os Item IDs para importar e sincronizar as contas.")
    print("  9. Para Investimentos (Rico, Tesouro, CDBs): vincule como contas")
    print("     do tipo 'Tracking' (Off-budget) para acompanhar o saldo de custódia")
    print("     e ver o relatório consolidado de 'Patrimônio Líquido' em Reports -> Net Worth.")
    print("=" * 65)

if __name__ == "__main__":
    main()
