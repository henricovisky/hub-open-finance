# Status do Projeto e Próximos Passos

> Sources: Plano de Implementação, 2026-10-25; Documento Técnico de Integração, 2026-10-25; Execução de Validação Sandbox, 2026-10-25
> Raw: [Plano](../../raw/hub-financeiro/2026-10-25-plano-implementacao.md); [DTI](../../raw/hub-financeiro/2026-10-25-dti-especificacao-tecnica.md)
> Updated: 2026-10-25

## Overview

Este artigo rastreia o andamento da execução do Hub Financeiro Pessoal & Familiar, documentando o progresso etapa por etapa, os critérios de aceite validados e as próximas ações a serem executadas conforme o Plano de Implementação.

## Andamento Atual das Etapas

| Etapa | Nome | Status | Detalhes / Evidências |
|---|---|---|---|
| **0** | Validação Pluggy Sandbox | 🟢 Concluída | `scripts/verify_pluggy_sandbox.py` validado com sucesso: POST /auth obtém API Key, 243 conectores Sandbox listados, POST /connect_token emitido com clientUserId seguro. |
| **1** | Infraestrutura e Esqueleto da API | 🟡 Em finalização | Docker Compose (Postgres Alpine 128MB tuning), FastAPI estruturado, Alembic configurado, testes criados. |
| **2** | Cliente Pluggy (Async) | ⚪ Pendente | Próxima etapa: implementar `backend/app/integrations/pluggy/client.py` com cache de 2h e retry backoff. |
| **3** | Autenticação e RBAC Mínimo | ⚪ Pendente | Aguarda Gate da Etapa 2 |
| **4** | Fluxo de Conexão (Connect Widget) | ⚪ Pendente | Aguarda Gate da Etapa 3 |
| **5** | Sincronização de Contas e Transações | ⚪ Pendente | Aguarda Gate da Etapa 4 |
| **6** | Webhooks e Fila Persistida | ⚪ Pendente | Aguarda Gate da Etapa 5 |
| **7** | Agendamento e Reconciliação | ⚪ Pendente | Aguarda Gate da Etapa 6 |
| **8** | Faturas e Investimentos | ⚪ Pendente | Aguarda Gate da Etapa 7 |
| **9** | Validação com Contas Reais | ⚪ Pendente | Aguarda Gate da Etapa 8 (Sandbox First) |
| **10+** | API de Leitura, Cálculos e Front PWA | ⚪ Roteiro | Aguarda conclusão da integração Pluggy |

---

## Próximos Passos Imediatos

1. **Finalizar Primeiro Commit Git (Etapa 1):**
   - Executar os testes automatizados com `pytest backend/tests/`.
   - Realizar o commit inicial limpo no repositório local.
2. **Iniciar Etapa 2 (Cliente Pluggy Assíncrono):**
   - Construir o módulo `backend/app/integrations/pluggy/` desacoplado.
   - Cache de API Key em memória com lock de concorrência.
   - Módulos finos por recurso (`items.py`, `accounts.py`, `transactions.py`, `connect.py`).

## See Also
- [Visão Geral e Arquitetura](visao-geral-arquitetura.md)
- [Integração Pluggy e Sincronização](integracao-pluggy.md)
