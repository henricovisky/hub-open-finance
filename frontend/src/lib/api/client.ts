let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
  if (token) {
    try {
      localStorage.setItem('hub_access_token', token);
    } catch {
      // Ignora erro de localStorage
    }
  } else {
    try {
      localStorage.removeItem('hub_access_token');
    } catch {
      // Ignora erro de localStorage
    }
  }
}

export function getAccessToken(): string | null {
  if (accessToken) return accessToken;
  try {
    const saved = localStorage.getItem('hub_access_token');
    if (saved) {
      accessToken = saved;
      return saved;
    }
  } catch {
    // Ignora
  }
  return null;
}

const API_BASE_URL = '/api/v1';

async function request<T>(method: string, path: string, data?: any, params?: Record<string, any>): Promise<T> {
  let url = `${API_BASE_URL}/${path.replace(/^\//, '')}`;

  if (params && Object.keys(params).length > 0) {
    const searchParams = new URLSearchParams();
    for (const [key, val] of Object.entries(params)) {
      if (val !== undefined && val !== null && val !== '') {
        searchParams.append(key, String(val));
      }
    }
    const queryString = searchParams.toString();
    if (queryString) {
      url += (url.includes('?') ? '&' : '?') + queryString;
    }
  }

  const token = getAccessToken();
  const headers: Record<string, string> = {
    'Accept': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const options: RequestInit = {
    method,
    headers,
    credentials: 'include',
  };

  if (data !== undefined && (method === 'POST' || method === 'PATCH' || method === 'PUT')) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(data);
  }

  const response = await fetch(url, options);

  if (response.status === 401) {
    setAccessToken(null);
    window.dispatchEvent(new CustomEvent('auth:expired'));
    throw new Error('Não autorizado (401)');
  }

  if (!response.ok) {
    let errorDetail = `Erro HTTP ${response.status}`;
    try {
      const errJson = await response.json();
      errorDetail = errJson.detail || errJson.message || errorDetail;
    } catch {
      // Falha ao parsear json de erro
    }
    throw new Error(errorDetail);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

export const api = {
  get: <T = any>(path: string, params?: Record<string, any>) => request<T>('GET', path, undefined, params),
  post: <T = any>(path: string, data?: any, params?: Record<string, any>) => request<T>('POST', path, data, params),
  patch: <T = any>(path: string, data?: any, params?: Record<string, any>) => request<T>('PATCH', path, data, params),
  put: <T = any>(path: string, data?: any, params?: Record<string, any>) => request<T>('PUT', path, data, params),
  delete: <T = any>(path: string, params?: Record<string, any>) => request<T>('DELETE', path, undefined, params),
};
