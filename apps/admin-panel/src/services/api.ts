import type { ApiResponse } from '@simrt/shared-types';

class ApiClient {
  private token: string | null = null;
  private readonly baseUrl = '/api/v1';

  constructor() {
    this.token = localStorage.getItem('simrt_token');
  }

  public setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('simrt_token', token);
    } else {
      localStorage.removeItem('simrt_token');
    }
  }

  public getToken(): string | null {
    return this.token;
  }

  public async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers = new Headers(options.headers || {});

    if (this.token) {
      headers.set('Authorization', `Bearer ${this.token}`);
    }

    if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, { ...options, headers });

    const json: ApiResponse<T> = await response.json().catch(() => ({
      success: false,
      error: { code: 'ERR_NETWORK', message: 'Gagal menghubungi server.' },
      timestamp: new Date().toISOString(),
    }));

    if (!response.ok || !json.success) {
      const err = new Error(json.error?.message || 'Terjadi kesalahan sistem.');
      (err as any).code = json.error?.code || 'ERR_UNKNOWN';
      (err as any).details = json.error?.details;
      throw err;
    }

    return json.data as T;
  }

  public get<T>(endpoint: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
    let url = endpoint;
    if (params) {
      const cleanParams: Record<string, string> = {};
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== '') {
          cleanParams[k] = String(v);
        }
      }
      const searchParams = new URLSearchParams(cleanParams);
      const query = searchParams.toString();
      if (query) {
        url += (url.includes('?') ? '&' : '?') + query;
      }
    }
    return this.request<T>(url, { method: 'GET' });
  }

  public post<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body),
    });
  }
}

export const api = new ApiClient();
