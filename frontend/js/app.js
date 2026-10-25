/**
 * Aplicação Mobile-First do Hub Financeiro (Alpine.js)
 */

document.addEventListener("alpine:init", () => {
  Alpine.data("hubApp", () => ({
    // Sessão
    isAuthenticated: !!window.api.token,
    currentUser: window.api.user,
    loginEmail: "admin@exemplo.com",
    loginPassword: "",
    loginLoading: false,
    loginError: "",

    // Navegação e Contexto
    activeTab: "dashboard",
    currentContext: "HOUSEHOLD", // "HOUSEHOLD", "PERSONAL", "ALL"
    hideValues: localStorage.getItem("hubfin_hide_values") === "true",

    // Estados de Dados
    loading: false,
    overview: null,
    cashflow: [],
    categoriesSummary: [],
    accounts: [],
    bills: [],
    transactions: [],
    investments: [],
    wealthSummary: null,
    connections: [],
    categories: [],

    // Modais e Drawers
    editTxModal: {
      open: false,
      tx: null,
      categoryId: "",
      context: "HOUSEHOLD",
      isIgnored: false,
      saving: false,
    },
    addConnModal: {
      open: false,
      manualItemId: "",
      saving: false,
    },
    accountDetailModal: {
      open: false,
      account: null,
      ownerContext: "HOUSEHOLD",
      saving: false,
    },

    // Notificações Toast
    toast: {
      show: false,
      message: "",
      type: "info", // "info", "success", "error"
      timeout: null,
    },

    init() {
      if (this.isAuthenticated) {
        this.refreshAll();
      }

      window.addEventListener("hubfin:unauthorized", () => {
        this.isAuthenticated = false;
        this.currentUser = null;
        this.showToast("Sessão expirada. Faça login novamente.", "error");
      });

      // Registra Service Worker se suportado
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("/sw.js").catch(() => {});
      }
    },

    showToast(message, type = "info") {
      this.toast.message = message;
      this.toast.type = type;
      this.toast.show = true;
      if (this.toast.timeout) clearTimeout(this.toast.timeout);
      this.toast.timeout = setTimeout(() => {
        this.toast.show = false;
      }, 4000);
    },

    toggleHideValues() {
      this.hideValues = !this.hideValues;
      localStorage.setItem("hubfin_hide_values", this.hideValues ? "true" : "false");
    },

    formatMoney(val) {
      if (val === null || val === undefined) return "R$ 0,00";
      if (this.hideValues) return "R$ •••••";
      const num = Number(val);
      return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    },

    formatDate(val) {
      if (!val) return "";
      const d = new Date(val);
      return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
    },

    formatDateTime(val) {
      if (!val) return "";
      const d = new Date(val);
      return d.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    },

    setContext(ctx) {
      if (this.currentUser?.role !== "ADMIN" && ctx !== "HOUSEHOLD") {
        return; // Membro só acessa Casa
      }
      this.currentContext = ctx;
      this.refreshCurrentTab();
    },

    setTab(tab) {
      this.activeTab = tab;
      this.refreshCurrentTab();
    },

    async doLogin() {
      if (!this.loginEmail || !this.loginPassword) {
        this.loginError = "Informe e-mail e senha.";
        return;
      }
      this.loginLoading = true;
      this.loginError = "";

      try {
        const resp = await window.api.login(this.loginEmail, this.loginPassword);
        this.isAuthenticated = true;
        this.currentUser = resp.user;
        this.showToast(`Bem-vindo, ${resp.user.name}!`, "success");
        await this.refreshAll();
      } catch (err) {
        this.loginError = err.message || "Credenciais inválidas.";
      } finally {
        this.loginLoading = false;
      }
    },

    async doLogout() {
      await window.api.logout();
      this.isAuthenticated = false;
      this.currentUser = null;
      this.overview = null;
      this.showToast("Sessão encerrada.", "info");
    },

    async refreshAll() {
      this.loading = true;
      try {
        await Promise.all([
          this.loadDashboard(),
          this.loadAccounts(),
          this.loadTransactions(),
          this.loadCategories(),
        ]);
      } catch (e) {
        console.error("Erro ao carregar dados:", e);
      } finally {
        this.loading = false;
      }
    },

    async refreshCurrentTab() {
      this.loading = true;
      try {
        if (this.activeTab === "dashboard") await this.loadDashboard();
        else if (this.activeTab === "accounts") await this.loadAccounts();
        else if (this.activeTab === "transactions") await this.loadTransactions();
        else if (this.activeTab === "investments") await this.loadInvestments();
        else if (this.activeTab === "settings") await this.loadConnections();
      } finally {
        this.loading = false;
      }
    },

    async loadDashboard() {
      try {
        const [ov, cf, cats] = await Promise.all([
          window.api.getDashboardOverview(this.currentContext),
          window.api.getDashboardCashflow(6, this.currentContext),
          window.api.getDashboardCategories(this.currentContext),
        ]);
        this.overview = ov;
        this.cashflow = cf;
        this.categoriesSummary = cats;
      } catch (err) {
        this.showToast(`Erro ao atualizar dashboard: ${err.message}`, "error");
      }
    },

    async loadAccounts() {
      try {
        const [accs, billsData] = await Promise.all([
          window.api.listAccounts(this.currentContext),
          window.api.listBills(),
        ]);
        this.accounts = accs;
        this.bills = billsData;
      } catch (err) {
        this.showToast(`Erro ao carregar contas: ${err.message}`, "error");
      }
    },

    async loadTransactions() {
      try {
        const data = await window.api.listTransactions({
          context: this.currentContext,
          page_size: 50,
        });
        this.transactions = data.results || [];
      } catch (err) {
        this.showToast(`Erro ao carregar extrato: ${err.message}`, "error");
      }
    },

    async loadInvestments() {
      try {
        const [invs, wealth] = await Promise.all([
          window.api.listInvestments(),
          window.api.getWealthSummary(),
        ]);
        this.investments = invs;
        this.wealthSummary = wealth;
      } catch (err) {
        this.showToast(`Erro ao carregar investimentos: ${err.message}`, "error");
      }
    },

    async loadConnections() {
      try {
        this.connections = await window.api.listConnections();
      } catch (err) {
        this.showToast(`Erro ao carregar conexões: ${err.message}`, "error");
      }
    },

    async loadCategories() {
      try {
        this.categories = await window.api.listCategories();
      } catch (e) {}
    },

    // Edição de Transação
    openEditTx(tx) {
      this.editTxModal.tx = tx;
      this.editTxModal.categoryId = tx.category_id || "";
      this.editTxModal.context = tx.context || "HOUSEHOLD";
      this.editTxModal.isIgnored = !!tx.is_ignored_in_analytics;
      this.editTxModal.open = true;
    },

    async saveTransaction() {
      if (!this.editTxModal.tx) return;
      this.editTxModal.saving = true;

      try {
        const payload = {
          category_id: this.editTxModal.categoryId || null,
          context: this.editTxModal.context,
          is_ignored_in_analytics: this.editTxModal.isIgnored,
        };
        const updated = await window.api.updateTransaction(this.editTxModal.tx.id, payload);

        // Atualiza na lista local
        const idx = this.transactions.findIndex((t) => t.id === updated.id);
        if (idx !== -1) {
          this.transactions[idx] = updated;
        }

        this.showToast("Transação atualizada com sucesso!", "success");
        this.editTxModal.open = false;
        // Recalcula dashboard
        this.loadDashboard();
      } catch (err) {
        this.showToast(`Falha ao salvar: ${err.message}`, "error");
      } finally {
        this.editTxModal.saving = false;
      }
    },

    // Edição de Conta
    openEditAccount(acc) {
      if (this.currentUser?.role !== "ADMIN") return;
      this.accountDetailModal.account = acc;
      this.accountDetailModal.ownerContext = acc.owner_context || "HOUSEHOLD";
      this.accountDetailModal.open = true;
    },

    async saveAccountContext() {
      if (!this.accountDetailModal.account) return;
      this.accountDetailModal.saving = true;

      try {
        const updated = await window.api.updateAccount(this.accountDetailModal.account.id, {
          owner_context: this.accountDetailModal.ownerContext,
        });

        const idx = this.accounts.findIndex((a) => a.id === updated.id);
        if (idx !== -1) this.accounts[idx] = updated;

        this.showToast("Contexto da conta alterado com sucesso!", "success");
        this.accountDetailModal.open = false;
        this.refreshAll();
      } catch (err) {
        this.showToast(`Falha ao alterar conta: ${err.message}`, "error");
      } finally {
        this.accountDetailModal.saving = false;
      }
    },

    // Sincronização e Conexões
    async triggerSync(connId) {
      this.showToast("Iniciando sincronização da instituição...", "info");
      try {
        const run = await window.api.syncConnection(connId);
        this.showToast(
          `Sincronização concluída! ${run.records_inserted} adicionados, ${run.records_updated} atualizados.`,
          "success"
        );
        this.refreshAll();
      } catch (err) {
        this.showToast(`Erro na sincronização: ${err.message}`, "error");
      }
    },

    async importExistingItem() {
      const itemId = this.addConnModal.manualItemId.trim();
      if (!itemId) {
        this.showToast("Informe o ID do Item da Pluggy.", "error");
        return;
      }

      this.addConnModal.saving = true;
      try {
        const conn = await window.api.completeConnection(itemId);
        this.showToast(`Conexão ${conn.institution_name} vinculada! Sincronizando...`, "success");
        this.addConnModal.open = false;
        this.addConnModal.manualItemId = "";
        await this.triggerSync(conn.id);
      } catch (err) {
        this.showToast(`Falha ao importar item: ${err.message}`, "error");
      } finally {
        this.addConnModal.saving = false;
      }
    },

    async openPluggyConnect() {
      this.showToast("Emitindo Connect Token temporário...", "info");
      try {
        const tokenResp = await window.api.getConnectToken();
        const connectToken = tokenResp.connect_token;

        if (!window.PluggyConnect) {
          this.showToast("Widget Pluggy indisponível. Verifique conexão à internet.", "error");
          return;
        }

        const pluggyConnect = new window.PluggyConnect({
          connectToken: connectToken,
          includeSandbox: true,
          onSuccess: async (itemData) => {
            this.showToast(`Instituição conectada na Pluggy! Concluindo registro...`, "info");
            try {
              const conn = await window.api.completeConnection(itemData.item.id);
              this.showToast(`Conexão ${conn.institution_name} criada com sucesso!`, "success");
              await this.triggerSync(conn.id);
            } catch (err) {
              this.showToast(`Erro ao registrar conexão: ${err.message}`, "error");
            }
          },
          onError: (err) => {
            this.showToast(`Erro no widget: ${err.message || "Falha na conexão"}`, "error");
          },
        });

        pluggyConnect.init();
      } catch (err) {
        this.showToast(`Erro ao iniciar widget: ${err.message}`, "error");
      }
    },
  }));
});
