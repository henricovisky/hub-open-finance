# Hub Financeiro Pessoal & Familiar (Open Finance Hub)

> Plataforma *self-hosted* de gestão financeira e patrimonial baseada em Open Finance (Pluggy), projetada para rodar com eficiência extrema em servidores enxutos (VPS de 1 GB RAM).

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python: 3.11+](https://img.shields.io/badge/Python-3.11+-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg)](https://fastapi.tiangolo.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16--alpine-336791.svg)](https://www.postgresql.org/)

---

## 🎯 Visão Geral

O **Hub Financeiro** é uma solução completa para controle de finanças pessoais e orçamentos familiares compartilhados. Ele integra contas bancárias, cartões de crédito e custódias de investimentos de forma automatizada via Open Finance, mantendo todos os dados sob custódia própria em banco relacional local, com custo de infraestrutura próximo de zero.

### Principais Características

- **Privacidade e Custódia Própria:** Seus dados financeiros e histórico permanecem no seu banco PostgreSQL, sem depender de plataformas de terceiros para guardar seu extrato a longo prazo.
- **Isolamento de Contextos (Casa vs. Pessoal):** O Administrador atribui dinamicamente na plataforma o contexto de cada conta (ex: finanças compartilhadas do casal vs. gastos estritamente individuais), com controle de acesso baseado em papéis (RBAC).
- **Leitura Sem Duplicidade:** Normalização financeira rigorosa — compras no cartão entram como despesa na data da compra; pagamentos de fatura entram como liquidação (evitando contagem dupla).
- **Design para VPS Econômica (1 GB RAM):** Arquitetura assíncrona com FastAPI, rotinas de agendamento embutidas no processo (`APScheduler`) e PostgreSQL 16 Alpine otimizado (`shared_buffers = 128MB`), dispensando Redis, Celery ou componentes pesados.
- **Sincronização Resiliente:** Webhooks com fila de eventos persistida, verificação de idempotência (`INSERT ... ON CONFLICT`) e rotinas diárias de reconciliação.

---

## 🏗️ Arquitetura do Sistema

```
                  ┌────────────────────────────────────────┐
                  │           Interface Web (PWA)          │
                  └───────────────────┬────────────────────┘
                                      │ HTTPS / JWT
                                      ▼
                  ┌────────────────────────────────────────┐
                  │             FastAPI Backend            │
                  │   • RBAC & Autenticação (Argon2id)     │
                  │   • Cálculos Financeiros & Fluxo Caixa │
                  │   • APScheduler (07:00, 13:30, 20:30)  │
                  └─────────┬────────────────────┬─────────┘
                            │                    │
                  Consultas │          Sync /    │ Webhook
                  & Upsert  │          Polling   │ Ingest
                            ▼                    ▼
               ┌───────────────────────┐   ┌───────────────────────┐
               │  PostgreSQL 16 Alpine │   │  Pluggy API (v2)      │
               │  (Docker com Tuning)  │   │  (Open Finance)       │
               └───────────────────────┘   └───────────────────────┘
```

---

## 🚀 Como Executar

### Pré-requisitos
- [Docker](https://docs.docker.com/get-docker/) e [Docker Compose](https://docs.docker.com/compose/)
- Python 3.11+ (para desenvolvimento local)
- Conta e credenciais no [Pluggy Dashboard](https://dashboard.pluggy.ai/)

### 1. Clonar o repositório e configurar variáveis

```bash
git clone https://github.com/seu-usuario/financas-pessoais.git
cd financas-pessoais
cp backend/.env.example backend/.env
```

Edite o arquivo `backend/.env` com suas credenciais:
```env
APP_ENV=development
APP_SECRET_KEY=sua_chave_secreta_minimo_32_caracteres
DATABASE_URL=postgresql+asyncpg://postgres:postgres@postgres:5432/hub_financeiro
PLUGGY_CLIENT_ID=seu_client_id_pluggy
PLUGGY_CLIENT_SECRET=seu_client_secret_pluggy
PLUGGY_WEBHOOK_SECRET=seu_webhook_secret_customizado
```

### 2. Subir com Docker Compose

```bash
docker compose up -d --build
```

O serviço da API estará disponível em `http://localhost:8000`.

- **Documentação Interativa (Swagger):** `http://localhost:8000/docs`
- **Healthcheck:** `http://localhost:8000/api/v1/health`

### 3. Executar Testes Automatizados

```bash
cd backend
python -m venv .venv
# Linux/macOS: source .venv/bin/activate | Windows: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
pytest
```

---

## 🔒 Segurança

- **Princípio do Menor Privilégio:** Escopo estritamente de consulta (somente leitura). Não há suporte para iniciação de pagamentos (PIX, TED, transferências).
- **Proteção de Segredos:** Nenhuma credencial bancária ou chave de API privada trafega para o navegador. O front-end recebe exclusivamente o Connect Token temporário (30 minutos).
- **Exposição em Rede:** Recomendado o uso de **Cloudflare Tunnel** (`cloudflared`) em produção para publicação HTTPS sem necessidade de abrir portas no roteador/firewall.

---

## 📄 Licença

Este projeto está sob a licença [MIT](LICENSE).
