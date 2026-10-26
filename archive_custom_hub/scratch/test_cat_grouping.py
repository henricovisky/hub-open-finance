import asyncio
import sys
import os

sys.path.insert(0, os.path.abspath("backend"))

from app.core.database import async_session_factory
from app.models.finance import Transaction, Category, TransactionType
from sqlalchemy import select, func

# Translation dictionary from English Pluggy category names to PT-BR friendly names
CATEGORY_TRANSLATIONS = {
    "Shopping": "Compras & Varejo",
    "Transfers": "Transferências",
    "Groceries": "Supermercado & Alimentação",
    "Transfer - PIX": "Transferência PIX",
    "Same person transfer": "Transferência Mesma Titularidade",
    "Investments": "Investimentos",
    "Proceeds interests and dividends": "Rendimentos & Dividendos",
    "Eating out": "Restaurantes & Bares",
    "Pharmacy": "Farmácia & Saúde",
    "Clothing": "Vestuário & Moda",
    "Fixed income": "Renda Fixa",
    "Taxi and ride-hailing": "Transporte por Aplicativo",
    "Credit card payment": "Pagamento de Fatura",
    "Telecommunications": "Telefonia & Internet",
    "Services": "Serviços Gerais",
    "Gas stations": "Combustível",
    "Automotive": "Automotivo",
    "Vehicle maintenance": "Manutenção Veicular",
    "Houseware": "Casa & Utilidades",
    "Bookstore": "Livraria & Papelaria",
    "Taxes on investments": "Impostos s/ Investimentos",
    "School": "Educação & Escola",
    "Parking": "Estacionamento",
    "Digital services": "Serviços Digitais",
    "Video streaming": "Streaming & Assinaturas",
    "Water": "Água & Saneamento",
    "Salary": "Salário & Remuneração",
    "Online shopping": "Compras Online",
    "Financing": "Financiamentos",
    "Electricity": "Energia Elétrica",
    "Dentist": "Dentista & Saúde",
    "Travel": "Viagens & Hospedagem",
    "Pet supplies and vet": "Pets & Veterinário",
    "Loans and financing": "Empréstimos & Financiamento",
    "Income taxes": "Imposto de Renda",
    "Gyms and fitness centers": "Academia & Esportes",
    "Transfer - TED": "Transferência TED",
    "Tickets": "Ingressos & Eventos",
    "Housing": "Moradia",
    "Gambling": "Apostas & Jogos",
    "Electronics": "Eletrônicos & Informática",
    "Food delivery": "Delivery & Comida",
    "Internet": "Internet",
}

async def main():
    async with async_session_factory() as session:
        # Query expenses grouped by provider_category
        stmt = (
            select(
                Transaction.provider_category,
                func.sum(func.abs(Transaction.amount)).label("total_spent")
            )
            .where(
                Transaction.type == TransactionType.EXPENSE,
                Transaction.is_internal_transfer == False,
                Transaction.is_ignored_in_analytics == False,
            )
            .group_by(Transaction.provider_category)
            .order_by(func.sum(func.abs(Transaction.amount)).desc())
        )
        res = await session.execute(stmt)
        rows = res.all()
        print(f"Categories found with expenses ({len(rows)}):")
        for r in rows:
            friendly = CATEGORY_TRANSLATIONS.get(r[0], r[0] or "Outros")
            print(f"  {friendly} ('{r[0]}'): R$ {r[1]:.2f}")

if __name__ == "__main__":
    asyncio.run(main())
