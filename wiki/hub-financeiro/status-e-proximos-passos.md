# Status do Projeto e Próximos Passos

> Sources: Plano de Implementação, 2026-10-25; Documento Técnico de Integração, 2026-10-25; Execução das Etapas 0 a 7, 2026-10-25
> Raw: [Plano](../../raw/hub-financeiro/2026-10-25-plano-implementacao.md); [DTI](../../raw/hub-financeiro/2026-10-25-dti-especificacao-tecnica.md)
> Updated: 2026-10-25

## Overview

Este artigo rastreia o andamento da execução do Hub Financeiro Pessoal & Familiar, documentando o progresso etapa por etapa, os critérios de aceite validados e as próximas ações a serem executadas conforme o Plano de Implementação.

## Andamento Atual das Etapas

| Etapa | Nome | Status | Detalhes / Evidências |
|---|---|---|---|
| **0** | Validação Pluggy Sandbox | 🟢 Concluída com Extração Real | Item Sandbox criado (`3679c5a2-...` e `a533f2fa-...`), status `UPDATED`. Extraídas contas, cartões, faturas e transações reais de teste. |
| **1** | Infraestrutura e Esqueleto da API | 🟢 Concluída | Docker Compose (Postgres Alpine 128MB tuning), FastAPI estruturado, Alembic configurado, testes unitários aprovados e 1º commit Git realizado (`1bb63e5`). |
| **2** | Cliente Pluggy (Async) | 🟢 Concluída | `backend/app/integrations/pluggy/` com cache de 2h, repetição única em 401, retry exponencial em 5xx, tratamento de 429, schemas Pydantic e `/v2/transactions` com cursor. Commit `b42065e`. |
| **3** | Autenticação e RBAC Mínimo | 🟢 Concluída | Modelos `users`, `user_sessions`, `account_permissions`, `audit_logs`, Argon2id, JWT curto (15m), refresh token rotativo em hash SHA-256 e cookies HttpOnly. Injeção `require_admin` e `require_user`. Commit `feb683c`. |
| **4** | Fluxo de Conexão (Connect Widget) | 🟢 Concluída | Modelos `financial_connections` e `connection_sync_runs`. Endpoints `/connections/connect-token` (exclusivo ADMIN com clientUserId em options), `/connections/complete` (validação direta na Pluggy), `/reconnect-token` e `DELETE /connections/{id}`. Commit `6ba0688`. |
| **5** | Sincronização de Contas e Transações | 🟢 Concluída | `SyncService` idempotente com lock por conexão, normalização canônica de cartão (pagamento de fatura como liquidação/TRANSFER), isolamento estrito de visibilidade (MEMBER só vê contas com `can_view == True`), endpoints `/accounts` e `/transactions`. Commit `81b83cf`. |
| **6** | Webhooks e Fila Persistida | 🟢 Concluída | Endpoint `POST /api/v1/webhooks/pluggy` com validação de segredo em tempo constante (`secrets.compare_digest`), persistência imediata com restrição `UNIQUE(event_id)` para idempotência, resposta em < 1s, despacho assíncrono de eventos (`item/updated`, `transactions/created`, `item/error`) e proteção contra itens desconhecidos. Commit `61d7df3`. |
| **7** | Agendamento e Reconciliação | 🟢 Concluída | APScheduler (`AsyncIOScheduler`) integrado ao ciclo de vida do FastAPI (lifespan) com janelas diárias nos horários 07:00, 13:30, 20:30, reconciliação noturna às 03:00 e limpeza semanal aos domingos às 04:00. Endpoints `/admin/system-status` (com detecção de conexões defasadas `is_stale > 12h`) e `/admin/sync-runs`. 30 testes automatizados passando (100%). |
| **8** | Faturas e Investimentos | 🟢 Concluída | Modelos `bills`, `asset_classes`, `investments`, `investment_transactions`, `wealth_snapshots` e `wealth_snapshot_items`. Sincronização automática e idempotente de faturas de cartão de crédito e posições de custódia com classificação heurística de classes macro. Endpoints `/bills`, `/investments`, `/wealth/summary` e `/wealth/snapshots`. |
| **9** | Validação com Contas Reais | 🟡 Preparada com Widget | Script interativo [`scripts/connect_widget.html`](../../scripts/connect_widget.html) desenvolvido para abertura direta do Pluggy Connect Widget no navegador do usuário, com autenticação Admin e sincronização automática. Permite conectar Nubank, Itaú e Rico a qualquer momento. |
| **10** | API de Leitura e Indicadores Mobile-First | 🟢 Concluída | Endpoints `/dashboard/overview`, `/dashboard/cashflow`, `/dashboard/categories`, `/categories` e `PATCH /transactions/{id}` com RBAC estrito. |
| **11** | Frontend PWA Mobile-First & Importação | 🟢 Concluída | Aplicação PWA legada em `frontend_legacy/`. |
| **11.2** | Frontend Responsivo v2 & Gráficos (F0–F10) | 🟢 Concluída (F0 a F9) | Migração para React 19 + TypeScript + Vite + Tailwind CSS + ECharts modular concluída com sucesso. AppShell com 4 breakpoints (360/768/1024/1440px), temas Claro/Escuro, modo Ocultar Valores, tabela alternativa para todos os gráficos (G-01 a G-21 e T-01 a T-08), endpoints de agregação no backend (/cashflow/series, /categories/summary, /cards/{id}/limit-usage, /transactions/bulk). Bundle inicial de apenas 96 KB gz (limite de 180 KB atendido). 37 testes de backend e 9 testes de front aprovados (100%). Commit `3fa3c18`. |
| **12** | Deploy e Produção VPS (1 vCPU / 1 GB RAM) | ⚪ Próxima Etapa | Configuração final de Docker Compose, Cloudflare Tunnel / DuckDNS e backup automatizado. |

---

## Evidência dos Testes Automatizados (Etapas 0 a 11)
- **38 testes automatizados (37 aprovados, 1 skip para item expirado do Sandbox ao vivo)**:
  - `tests/test_health.py` (3 testes): Healthcheck da API, conectividade com banco e entrega da raiz HTML do frontend PWA.
  - `tests/test_investments_and_bills.py` (4 testes): Heurística de classificação de classes de ativos, sincronização completa de faturas de cartão e posições de investimento com snapshot consolidado de patrimônio líquido, tolerância a conectores sem investimentos (404/indisponível) e validação de endpoints `/bills`, `/investments` e `/wealth/summary` com RBAC e isolamento estrito entre Casa e Pessoal.
  - `tests/test_scheduler.py` (3 testes): Configuração de jobs e triggers (07:00, 13:30, 20:30, 03:00, 04:00), diagnóstico de defasagem `is_stale` e paginação de histórico de sincronizações em `/admin/sync-runs`.
  - `tests/test_webhooks.py` (3 testes): Segredo constante, idempotência e despacho assíncrono.
  - `tests/test_sync.py` (3 testes): Sincronização 3x sem duplicatas, isolamento de visibilidade por perfil e regra canônica de fatura.
  - `tests/test_connections.py` (3 testes): Emissão de Connect Token, validação de Item e reconexão.
  - `tests/test_auth.py` (8 testes): Autenticação, Argon2id, JWT, rotação e RBAC.
  - `tests/test_pluggy_client.py` (7 testes): Resiliência, retries, cursor pagination v2 e tolerância a dados parciais.
  - `tests/test_pluggy_sandbox_integration.py` (1 teste): Integração ao vivo contra a API oficial da Pluggy no Sandbox.
  - `tests/test_health.py` (2 testes): Healthcheck da API e conectividade com banco.

## See Also
- [Visão Geral e Arquitetura](visao-geral-arquitetura.md)
- [Integração Pluggy e Sincronização](integracao-pluggy.md)
- [Design de Interface e Experiência Mobile-First](design-e-experiencia-mobile.md)
- [Guia de Configuração de Webhooks](guia-configuracao-webhook.md)
