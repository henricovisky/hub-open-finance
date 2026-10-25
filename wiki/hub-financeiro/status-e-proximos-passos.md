# Status do Projeto e Próximos Passos

> Sources: Plano de Implementação, 2026-10-25; Documento Técnico de Integração, 2026-10-25; Execução de Validação Sandbox, 2026-10-25; Extração de Dados Sandbox, 2026-10-25; Etapa 2 Concluída, 2026-10-25; Etapa 3 Concluída, 2026-10-25
> Raw: [Plano](../../raw/hub-financeiro/2026-10-25-plano-implementacao.md); [DTI](../../raw/hub-financeiro/2026-10-25-dti-especificacao-tecnica.md)
> Updated: 2026-10-25

## Overview

Este artigo rastreia o andamento da execução do Hub Financeiro Pessoal & Familiar, documentando o progresso etapa por etapa, os critérios de aceite validados e as próximas ações a serem executadas conforme o Plano de Implementação.

## Andamento Atual das Etapas

| Etapa | Nome | Status | Detalhes / Evidências |
|---|---|---|---|
| **0** | Validação Pluggy Sandbox | 🟢 Concluída com Extração Real | Item Sandbox criado (`3679c5a2-...` e `a533f2fa-...`), status `UPDATED`. Extraídas com sucesso: contas bancárias, cartões, faturas e transações reais de teste. |
| **1** | Infraestrutura e Esqueleto da API | 🟢 Concluída | Docker Compose (Postgres Alpine 128MB tuning), FastAPI estruturado, Alembic configurado, testes unitários aprovados e 1º commit Git realizado (`1bb63e5`). |
| **2** | Cliente Pluggy (Async) | 🟢 Concluída | `backend/app/integrations/pluggy/` com cache de 2h, repetição única em 401, retry exponencial em 5xx, tratamento de 429, schemas Pydantic e `/v2/transactions` com cursor. Commit `b42065e`. |
| **3** | Autenticação e RBAC Mínimo | 🟢 Concluída | Modelos SQLAlchemy 2 (`users`, `user_sessions`, `account_permissions`, `feature_permissions`, `audit_logs`), Argon2id, JWT curto (15m), refresh token rotativo em hash SHA-256 e cookies HttpOnly. Injeção `require_admin` e `require_user`. 18 testes automatizados passando (100%). |
| **4** | Fluxo de Conexão (Connect Widget) | 🟡 Próxima Etapa | Endpoints `POST /connections/connect-token` (com clientUserId dentro de options e restrito a ADMIN), `POST /connections/complete`, `POST /connections/{id}/reconnect-token`, models `financial_connections` e `connection_sync_runs`. |
| **5** | Sincronização de Contas e Transações | ⚪ Pendente | Aguarda Gate da Etapa 4 |
| **6** | Webhooks e Fila Persistida | ⚪ Pendente | Aguarda Gate da Etapa 5 |
| **7** | Agendamento e Reconciliação | ⚪ Pendente | Aguarda Gate da Etapa 6 |
| **8** | Faturas e Investimentos | ⚪ Pendente | Aguarda Gate da Etapa 7 |
| **9** | Validação com Contas Reais | ⚪ Pendente | Aguarda Gate da Etapa 8 (Sandbox First) |
| **10+** | API de Leitura, Cálculos e Front PWA | ⚪ Roteiro | Aguarda conclusão da integração Pluggy |

---

## Evidência dos Testes Automatizados (Etapa 3)
- `tests/test_auth.py` (8 testes):
  - Login com sucesso e verificação de cookies HttpOnly + JSON Bearer.
  - Rejeição de senhas inválidas e usuários inativos.
  - Rota `/auth/me` protegida.
  - Rotação estrita de refresh token (o token antigo é revogado e não pode ser reutilizado).
  - Logout com revogação de sessão e limpeza de cookies.
  - RBAC validado: ADMIN acessa `/admin/system-status`, MEMBER recebe `403 Forbidden` e anônimo recebe `401 Unauthorized`.
- Suíte total: **18 testes passando em 2.61s**.

## See Also
- [Visão Geral e Arquitetura](visao-geral-arquitetura.md)
- [Integração Pluggy e Sincronização](integracao-pluggy.md)
- [Design de Interface e Experiência Mobile-First](design-e-experiencia-mobile.md)
