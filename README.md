# Gestão Financeira Pessoal & Familiar com Actual Budget e Pluggy.ai

> Sistema de gestão financeira pessoal e controle orçamentário familiar baseado no **Actual Budget** (Local-First, Open Source) integrado diretamente com o Open Finance brasileiro via **Pluggy.ai**.

---

## 🎯 Por que Actual Budget?

- **Consumo de Memória Quase Nulo (~40 MB de RAM):** Container Node.js leve com banco SQLite local criptografado.
- **Integração Nativa com Pluggy.ai:** Sincronização automática de contas correntes, poupanças, cartões de crédito e custódias de investimento.
- **Local-First & Privacidade:** Criptografia de ponta a ponta (E2EE). Todos os seus dados financeiros ficam salvos sob seu controle em `./actual-data`.
- **Aplicativo Mobile (PWA):** Acesse pelo navegador no computador ou instale no celular (Android/iOS) como Progressive Web App (PWA) rápido e responsivo.
- **Patrimônio Líquido e Investimentos:** Contas de custódia (Rico/XP, CDBs, Tesouro Direto) entram como contas *Tracking* (Off-budget) alimentando o gráfico consolidado de **Patrimônio Líquido (*Net Worth*)**.

---

## 🚀 Como Iniciar

### 1. Pré-requisitos
- [Docker](https://docs.docker.com/get-docker/) e Docker Compose instalados.

### 2. Iniciar o Servidor
No terminal, na pasta raiz do projeto:

```bash
docker compose up -d
```

O Actual Budget estará disponível em: **`http://localhost:5006`** (ou no IP da sua VPS na porta 5006).

---

## 🔑 Ativação da Sincronização Bancária (Pluggy.ai)

### Passo 1: Habilitar o conector
1. Acesse `http://localhost:5006` e configure sua senha de acesso inicial.
2. Crie ou abra seu arquivo de orçamento.
3. No menu lateral, acesse **Settings** > **Advanced Settings** > **Experimental Features**.
4. Marque a caixa **Pluggy.ai Bank Sync**.

### Passo 2: Vincular as Contas
1. Clique em **+ Add Account** (Adicionar Conta) no menu lateral.
2. Selecione **Set up bank sync** e escolha o card **Pluggy.ai**.
3. Insira suas credenciais da Pluggy (armazenadas no arquivo `.env`):
   - **Client ID:** `ddf0ef0a-e904-418d-82e9-df338aeabd82`
   - **Client Secret:** `NC60tb6G23zxTO4G8lTcvmy9uBw6Fhpld6YFgIyU0CE`
4. Quando solicitado os **Item IDs** das contas já conectadas no Meu Pluggy:
   - **XP / Rico (Conta + Cartão Visa Infinite + Investimentos):** `a5c3ae09-e773-4559-8518-94bb13f8711e`
   - **Itaú Unibanco (Conta Corrente + Poupança + CDBs):** `a5308e50-afe0-4e95-a934-558f8bcfe480`
   - **Nubank (Conta Conjunta/Casal + Cartão Platinum):** `6ca9e4da-dfac-48e7-b63a-7994650ac982`

*(Você também pode rodar `python scripts/print_pluggy_setup.py` para visualizar essas credenciais no terminal).*

---

## 📈 Investimentos e Patrimônio Líquido (*Net Worth*)

Para acompanhar seu patrimônio total e carteira de investimentos sem bagunçar seu orçamento mensal:

1. **Contas de Acompanhamento (*Tracking / Off-budget*):**
   - Ao vincular contas de investimentos (Rico, Tesouro, CDBs), marque-as como **Tracking Account** (ou "Fora do Orçamento").
   - O saldo de custódia e aportes serão atualizados sem contar como "dinheiro disponível para gastar no mês".
2. **Tela de Patrimônio Líquido:**
   - Acesse **Reports** > **Net Worth**.
   - O sistema calcula e plota automaticamente a evolução do seu patrimônio:
     $$\text{Patrimônio Líquido} = \text{Ativos (Contas + Investimentos)} - \text{Passivos (Faturas + Dívidas)}$$

---

## 👥 Estratégia Casa vs. Pessoal (Múltiplos Orçamentos)

O Actual Budget suporta múltiplos arquivos de orçamento independentes com troca rápida em 1 clique:

- **Orçamento 1: "Casa & Família":**
  - Vincula apenas a conta conjunta e cartões compartilhados do Nubank.
  - Usado por você e sua esposa no dia a dia para despesas domésticas.
- **Orçamento 2: "Pessoal & Patrimônio":**
  - Vincula a conta do Itaú, cartões individuais e custódias da Rico/XP.
  - Focado em despesas pessoais e acompanhamento do patrimônio total.

---

## 🗄️ Estrutura do Repositório

```
├── .env                       # Credenciais da Pluggy e porta do servidor
├── docker-compose.yml         # Definição do serviço actual-server (~40 MB RAM)
├── actual-data/               # Volume local onde o SQLite e orçamentos ficam salvos
├── scripts/
│   └── print_pluggy_setup.py  # Script auxiliar para exibir credenciais e instruções
└── archive_custom_hub/        # Arquivo de código legado (FastAPI, React v2, etc.)
```
