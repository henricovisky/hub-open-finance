# Visão Geral e Arquitetura do Hub Financeiro

> Sources: Documento de Planejamento e Arquitetura (PRD), 2026-10-25; Documento Técnico de Integração (DTI), 2026-10-25
> Raw: [DPA](../../raw/hub-financeiro/2026-10-25-dpa-arquitetura-prd.md); [DTI](../../raw/hub-financeiro/2026-10-25-dti-especificacao-tecnica.md)
> Updated: 2026-10-25

## Overview

O Hub Financeiro é uma plataforma self-hosted de gestão patrimonial e orçamentária pessoal/familiar com suporte a Open Finance via Pluggy. A arquitetura é desenhada com foco em auto-hospedagem de baixo custo, rodando confortavelmente dentro dos limites estritos de uma VPS com 1 vCPU e 1 GB de RAM, garantindo custódia permanente dos dados financeiros em PostgreSQL local.

## Princípios de Arquitetura

### 1. Dimensionamento Enxuto (1 GB RAM)
- **Swap Obrigatório:** 2 GB de memória swap em SSD para prevenir encerramento por OOM Killer.
- **Stack Direta:** FastAPI + Uvicorn + PostgreSQL 16 Alpine.
- **Sem Filas Pesadas:** O agendamento de tarefas (`APScheduler`) e processamento de webhooks rodam no mesmo processo da API com advisory lock no PostgreSQL, dispensando Redis, Celery ou Kafka.
- **Tuning de Banco:** PostgreSQL configurado com `shared_buffers = 128MB` e `work_mem = 4MB`.

### 2. Rede e Segurança
- **Cloudflare Tunnel (`cloudflared`):** Comunicação segura sem abertura de portas no roteador (portas 80/443 fechadas). O IP real da máquina permanece protegido e webhooks da Pluggy são entregues via HTTPS autenticado.
- **Escopo Read-Only:** Nenhuma função de escrita bancária, transferência ou iniciação de PIX/TED é suportada.
- **Credenciais Isoladas:** API Keys da Pluggy e segredos JWT residem apenas em variáveis de ambiente e memória do servidor, nunca trafegando para o cliente web.

### 3. Modelo de Acesso e Permissões (RBAC)
- **Papéis:** `ADMIN` (acesso irrestrito e gestão de conexões) e `MEMBER` (acesso estritamente às contas concedidas).
- **Contextos Dinâmicos:** As contas são categorizadas em contextos como `HOUSEHOLD` (Casa) e `PERSONAL` (Pessoal) via painel do Administrador, garantindo isolamento total de dados sensíveis nas consultas.

## See Also
- [Integração Pluggy e Sincronização](integracao-pluggy.md)
- [Status do Projeto e Próximos Passos](status-e-proximos-passos.md)
