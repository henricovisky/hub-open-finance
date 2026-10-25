# Guia de Configuração de Webhooks Pluggy em Produção

> Sources: Documento Técnico de Integração (DTI §6.1, §6.2), Documento de Planejamento e Arquitetura (DPA §4)
> Updated: 2026-10-25

## 1. Visão Geral

Os webhooks da Pluggy são notificações HTTPS enviadas pelo provedor assim que uma instituição bancária disponibiliza novas movimentações ou altera o estado de uma conexão. 

No Hub Financeiro, o endpoint `/api/v1/webhooks/pluggy` foi desenhado com foco em:
- **Zero confiança:** Validação de segredo customizado em tempo constante (`secrets.compare_digest`).
- **Idempotência estrita:** Deduplicação pelo identificador do evento (`UNIQUE event_id`).
- **Processamento desacoplado:** Resposta HTTP 202 em menos de 1 segundo para evitar reenvios desnecessários pela Pluggy (timeout de 10s documentado).

---

## 2. Passo a Passo de Configuração no Servidor

### Passo 1: Obter a URL Pública Segura (Cloudflare Tunnel)
Como a aplicação roda em servidor local/VPS de 1 GB RAM, a recomendação oficial é utilizar o **Cloudflare Tunnel** (`cloudflared`). Ele não exige abrir as portas 80/443 no roteador e oculta 100% o seu IP real.

1. No seu servidor, certifique-se de que o túnel está roteando o tráfego HTTPS para o container `api:8000`.
2. A URL pública de webhook será:
   ```text
   https://seu-dominio.com/api/v1/webhooks/pluggy
   ```

*(Alternativa sem domínio próprio: DuckDNS apontando para o seu IP público com encaminhamento exclusivo na porta do webhook).*

---

### Passo 2: Gerar e Configurar o Segredo do Webhook

1. No servidor, gere uma chave criptográfica forte:
   ```bash
   openssl rand -hex 32
   ```
2. Adicione a chave no arquivo `backend/.env` do servidor:
   ```env
   PLUGGY_WEBHOOK_SECRET=sua_chave_hexadecimal_gerada_acima
   ```
3. Reinicie o container da API para carregar a nova variável:
   ```bash
   docker compose restart api
   ```

---

### Passo 3: Cadastrar o Webhook no Dashboard da Pluggy

1. Acesse o [Pluggy Dashboard](https://dashboard.pluggy.ai/) com sua conta.
2. Navegue até **Developers** > **Webhooks** (ou Configurações da Aplicação).
3. Clique em **Create Webhook** / **Novo Webhook**:
   - **URL:** `https://seu-dominio.com/api/v1/webhooks/pluggy`
   - **Eventos:** Selecione os eventos essenciais:
     - `item/created`
     - `item/updated`
     - `item/error`
     - `item/waiting_user_input`
     - `item/deleted`
     - `transactions/created`
     - `transactions/updated`
     - `transactions/deleted`
   - **Custom Headers (Cabeçalhos Customizados):**
     - Nome: `X-Pluggy-Webhook-Secret`
     - Valor: `sua_chave_hexadecimal_gerada_acima` (o mesmo valor configurado no `.env`).
4. Salve a configuração.

---

### Passo 4: Testar a Conexão

Você pode enviar um evento de teste via curl para verificar se seu servidor responde 202 Accepted:

```bash
curl -X POST https://seu-dominio.com/api/v1/webhooks/pluggy \
  -H "Content-Type: application/json" \
  -H "X-Pluggy-Webhook-Secret: sua_chave_hexadecimal_gerada_acima" \
  -d '{
    "event": "item/updated",
    "id": "teste-manual-001",
    "itemId": "seu-item-uuid"
  }'
```

Resposta esperada:
```json
{
  "status": "received",
  "event_id": "teste-manual-001",
  "is_duplicate": false
}
```

No painel de administração (`GET /api/v1/admin/sync-runs`), você poderá auditar o histórico de eventos recebidos e processados.
