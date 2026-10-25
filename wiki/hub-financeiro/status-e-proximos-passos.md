# Status do Projeto e Próximos Passos

> Sources: Plano de Implementação, 2026-10-25; Documento Técnico de Integração, 2026-10-25; Execução das Etapas 0 a 6, 2026-10-25
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
| **6** | Webhooks e Fila Persistida | 🟢 Concluída | Endpoint `POST /api/v1/webhooks/pluggy` com validação de segredo em tempo constante (`secrets.compare_digest`), persistência imediata com restrição `UNIQUE(event_id)` para idempotência, resposta em < 1s, despacho assíncrono de eventos (`item/updated`, `transactions/created`, `item/error`) e proteção contra itens desconhecidos. |
| **7** | Agendamento e Reconciliação | 🟡 Próxima Etapa | APScheduler com advisory lock no banco: janelas 07:00, 13:30, 20:30, reconciliação diária de eventos perdidos e endpoints administrativos de monitoramento. |
| **8** | Faturas e Investimentos | ⚪ Pendente | Aguarda Gate da Etapa 7 |
| **9** | Validação com Contas Reais | ⚪ Pendente | Aguarda Gate da Etapa 8 (Sandbox First) |
| **10+** | API de Leitura, Cálculos e Front PWA | ⚪ Roteiro | Aguarda conclusão da integração Pluggy |

---

## Evidência dos Testes Automatizados (Etapas 0 a 6)
- **27 testes automatizados passando com 100% de sucesso em 6.64s**:
  - `tests/test_auth.py` (8 testes): Autenticação, Argon2id, JWT, rotação e RBAC.
  - `tests/test_connections.py` (3 testes): Emissão de Connect Token, validação de Item e reconexão.
  - `tests/test_sync.py` (3 testes): Sincronização 3x sem duplicatas, isolamento de visibilidade por perfil e regra canônica de fatura.
  - `tests/test_webhooks.py` (3 testes): Validação de segredo com constant-time, idempotência estrita de eventos e despacho de erros/atualizações.
  - `tests/test_pluggy_client.py` (7 testes): Resiliência, retries, cursor pagination v2 e tolerância a dados parciais.
  - `tests/test_pluggy_sandbox_integration.py` (1 teste): Integração ao vivo contra a API oficial da Pluggy no Sandbox.
  - `tests/test_health.py` (2 testes): Healthcheck da API e conectividade com banco.

## See Also
- [Visão Geral e Arquitetura](visao-geral-arquitetura.md)
- [Integração Pluggy e Sincronização](integracao-pluggy.md)
- [Design de Interface e Experiência Mobile-First](design-e-experiencia-mobile.md)
