# Integração Pluggy e Sincronização de Dados

> Sources: Documento Técnico de Integração (DTI), 2026-10-25; Plano de Implementação, 2026-10-25
> Raw: [DTI](../../raw/hub-financeiro/2026-10-25-dti-especificacao-tecnica.md); [Plano](../../raw/hub-financeiro/2026-10-25-plano-implementacao.md)
> Updated: 2026-10-25

## Overview

A sincronização de dados financeiros baseia-se na API da Pluggy (v2). O sistema combina notificações via webhooks orientados a eventos para captura rápida com rotinas diárias de polling e reconciliação agendadas em três horários-chave, garantindo idempotência e integridade sem duplicar movimentações.

## Fluxo de Autenticação e Conexão

### Ciclo de Vida de Credenciais
- **API Key (Backend):** Obtida via `POST /auth` com `CLIENT_ID` e `CLIENT_SECRET`. Tem validade de 2 horas e deve ser armazenada em cache na memória do processo, sendo renovada automaticamente 5 minutos antes da expiração.
- **Connect Token (Frontend):** Emitido via `POST /connect_token` com validade de 30 minutos e escopo limitado ao widget Pluggy Connect. O cliente web nunca recebe as credenciais primárias.

### Regras de Sincronização e Idempotência
1. **Webhooks Imediatos:** O endpoint `POST /api/v1/webhooks/pluggy` persiste o evento em `webhook_events` com restrição `UNIQUE(event_id)` e responde `2xx` em menos de 10 segundos. O processamento ocorre de forma assíncrona.
2. **Janelas Agendadas:**
   - **07:00:** Compensações noturnas e débitos automáticos.
   - **13:30:** Movimentações matinais e liquidações parciais.
   - **20:30:** Fechamento comercial e consolidação de compras no cartão.
3. **Upsert Estrito:** Transações e contas utilizam `INSERT ... ON CONFLICT DO UPDATE` vinculadas ao identificador do provedor.
4. **Regra Canônica de Cartão:**
   - A compra com cartão representa a despesa na data da transação.
   - O pagamento da fatura representa a liquidação da obrigação, não uma segunda despesa.

## See Also
- [Visão Geral e Arquitetura](visao-geral-arquitetura.md)
- [Status do Projeto e Próximos Passos](status-e-proximos-passos.md)
