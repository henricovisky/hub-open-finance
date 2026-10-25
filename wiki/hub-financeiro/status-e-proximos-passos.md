# Status do Projeto e Próximos Passos

> Sources: Plano de Implementação, 2026-10-25; Documento Técnico de Integração, 2026-10-25; Execução de Validação Sandbox, 2026-10-25; Extração de Dados Sandbox, 2026-10-25; Etapa 2 Concluída, 2026-10-25
> Raw: [Plano](../../raw/hub-financeiro/2026-10-25-plano-implementacao.md); [DTI](../../raw/hub-financeiro/2026-10-25-dti-especificacao-tecnica.md)
> Updated: 2026-10-25

## Overview

Este artigo rastreia o andamento da execução do Hub Financeiro Pessoal & Familiar, documentando o progresso etapa por etapa, os critérios de aceite validados e as próximas ações a serem executadas conforme o Plano de Implementação.

## Andamento Atual das Etapas

| Etapa | Nome | Status | Detalhes / Evidências |
|---|---|---|---|
| **0** | Validação Pluggy Sandbox | 🟢 Concluída com Extração Real | Item Sandbox criado (`3679c5a2-...` e `a533f2fa-...`), status `UPDATED`. Extraídas com sucesso: contas bancárias, cartões, faturas e transações reais de teste. |
| **1** | Infraestrutura e Esqueleto da API | 🟢 Concluída | Docker Compose (Postgres Alpine 128MB tuning), FastAPI estruturado, Alembic configurado, testes unitários aprovados e 1º commit Git realizado (`1bb63e5`). |
| **2** | Cliente Pluggy (Async) | 🟢 Concluída | `backend/app/integrations/pluggy/` 100% implementado e testado. Suporte a cache em memória de API Key (2h), repetição única em 401, retry exponencial em 5xx, tratamento de 429, schemas Pydantic anti-corrupção e paginação por cursor em `/v2/transactions`. 10 testes automatizados passando (100%). |
| **3** | Autenticação e RBAC Mínimo | 🟡 Próxima Etapa | Migrations de usuários e sessões (`users`, `user_sessions`, `account_permissions`), Argon2id, JWT curto e cookies HttpOnly, endpoints de login/logout/me e isolamento estrito entre ADMIN e MEMBER. |
| **4** | Fluxo de Conexão (Connect Widget) | ⚪ Pendente | Aguarda Gate da Etapa 3 |
| **5** | Sincronização de Contas e Transações | ⚪ Pendente | Aguarda Gate da Etapa 4 |
| **6** | Webhooks e Fila Persistida | ⚪ Pendente | Aguarda Gate da Etapa 5 |
| **7** | Agendamento e Reconciliação | ⚪ Pendente | Aguarda Gate da Etapa 6 |
| **8** | Faturas e Investimentos | ⚪ Pendente | Aguarda Gate da Etapa 7 |
| **9** | Validação com Contas Reais | ⚪ Pendente | Aguarda Gate da Etapa 8 (Sandbox First) |
| **10+** | API de Leitura, Cálculos e Front PWA | ⚪ Roteiro | Aguarda conclusão da integração Pluggy |

---

## Evidência dos Testes Automatizados (Etapa 2)
- `tests/test_health.py` (2 testes): Healthcheck banco saudável e degradado.
- `tests/test_pluggy_client.py` (7 testes): Cache de chave, renovação em 401, parada imediata em 403, recuperação em 5xx, bloqueio em 429, iterador assíncrono v2 por cursor e tolerância a campos nulos.
- `tests/test_pluggy_sandbox_integration.py` (1 teste): Integração ao vivo de ponta a ponta com o Sandbox da Pluggy (Auth -> Connect Token -> Get Item -> Get Accounts -> Get V2 Transactions).

## See Also
- [Visão Geral e Arquitetura](visao-geral-arquitetura.md)
- [Integração Pluggy e Sincronização](integracao-pluggy.md)
- [Design de Interface e Experiência Mobile-First](design-e-experiencia-mobile.md)
