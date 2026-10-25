/**
 * Cliente de API do Hub Financeiro
 * Gerencia tokens de autenticação, renovação automática e chamadas aos endpoints.
 */

const API_BASE = "/api/v1";

class ApiClient {
  constructor() {
    this.token = localStorage.getItem("hubfin_access_token");
    this.user = JSON.parse(localStorage.getItem("hubfin_user") || "null");
  }

  setSession(accessToken, user) {
    this.token = accessToken;
    this.user = user;
    if (accessToken) {
      localStorage.setItem("hubfin_access_token", accessToken);
    } else {
      localStorage.removeItem("hubfin_access_token");
    }
    if (user) {
      localStorage.setItem("hubfin_user", JSON.stringify(user));
    } else {
      localStorage.removeItem("hubfin_user");
    }
  }

  clearSession() {
    this.token = null;
    this.user = null;
    localStorage.removeItem("hubfin_access_token");
    localStorage.removeItem("hubfin_user");
  }

  async request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {})
    };

    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }

    try {
      let response = await fetch(url, { ...options, headers });

      // Se token expirou (401), tenta refresh automático
      if (response.status === 401 && this.token) {
        const refreshed = await this.refreshToken();
        if (refreshed) {
          headers["Authorization"] = `Bearer ${this.token}`;
          response = await fetch(url, { ...options, headers });
        } else {
          this.clearSession();
          window.dispatchEvent(new CustomEvent("hubfin:unauthorized"));
          throw new Error("Sessão expirada. Faça login novamente.");
        }
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Erro HTTP ${response.status}`);
      }

      if (response.status === 204) {
        return null;
      }
      return await response.json();
    } catch (err) {
      console.error(`Erro na requisição ${endpoint}:`, err);
      throw err;
    }
  }

  async refreshToken() {
    try {
      const resp = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      if (resp.ok) {
        const data = await resp.json();
        this.token = data.access_token;
        localStorage.setItem("hubfin_access_token", data.access_token);
        return true;
      }
    } catch (e) {
      console.warn("Falha no refresh token:", e);
    }
    return false;
  }

  // Auth
  async login(email, password) {
    const data = await this.request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });
    this.setSession(data.access_token, data.user);
    return data;
  }

  async logout() {
    try {
      await this.request("/auth/logout", { method: "POST" });
    } finally {
      this.clearSession();
    }
  }

  async getMe() {
    return await this.request("/auth/me");
  }

  // Dashboard & Analytics
  async getDashboardOverview(context) {
    const query = context && context !== "ALL" ? `?context=${context}` : "";
    return await this.request(`/dashboard/overview${query}`);
  }

  async getDashboardCashflow(months = 6, context) {
    let query = `?months=${months}`;
    if (context && context !== "ALL") query += `&context=${context}`;
    return await this.request(`/dashboard/cashflow${query}`);
  }

  async getDashboardCategories(context) {
    const query = context && context !== "ALL" ? `?context=${context}` : "";
    return await this.request(`/dashboard/categories${query}`);
  }

  // Contas & Cartões
  async listAccounts(context) {
    const query = context && context !== "ALL" ? `?context=${context}` : "";
    return await this.request(`/accounts${query}`);
  }

  async updateAccount(accountId, payload) {
    return await this.request(`/accounts/${accountId}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
  }

  // Faturas de Cartão
  async listBills(accountId) {
    const query = accountId ? `?account_id=${accountId}` : "";
    return await this.request(`/bills${query}`);
  }

  // Transações
  async listTransactions(params = {}) {
    const q = new URLSearchParams();
    if (params.context && params.context !== "ALL") q.append("context", params.context);
    if (params.account_id) q.append("account_id", params.account_id);
    if (params.page) q.append("page", params.page);
    if (params.page_size) q.append("page_size", params.page_size);
    return await this.request(`/transactions?${q.toString()}`);
  }

  async updateTransaction(txId, payload) {
    return await this.request(`/transactions/${txId}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
  }

  // Investimentos
  async listInvestments(assetClass) {
    const query = assetClass ? `?asset_class=${assetClass}` : "";
    return await this.request(`/investments${query}`);
  }

  async getWealthSummary() {
    return await this.request("/wealth/summary");
  }

  async listWealthSnapshots(days = 30) {
    return await this.request(`/wealth/snapshots?days=${days}`);
  }

  // Categorias
  async listCategories() {
    return await this.request("/categories");
  }

  async createCategory(payload) {
    return await this.request("/categories", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }

  // Conexões
  async listConnections() {
    return await this.request("/connections");
  }

  async getConnectToken() {
    return await this.request("/connections/connect-token", { method: "POST" });
  }

  async completeConnection(itemId) {
    return await this.request("/connections/complete", {
      method: "POST",
      body: JSON.stringify({ item_id: itemId })
    });
  }

  async syncConnection(connectionId) {
    return await this.request(`/connections/${connectionId}/sync`, { method: "POST" });
  }

  async deleteConnection(connectionId) {
    return await this.request(`/connections/${connectionId}`, { method: "DELETE" });
  }
}

window.api = new ApiClient();
