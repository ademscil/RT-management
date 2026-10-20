import type { ApiResponse } from '@simrt/shared-types';

const rawEnvUrl = (import.meta as any).env?.VITE_API_URL;
export const API_ORIGIN = (rawEnvUrl && !rawEnvUrl.includes('rt-management-six'))
  ? rawEnvUrl.replace(/\/+$/, '')
  : 'https://rt-management-api.vercel.app';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

class ApiClient {
  private token: string | null = null;
  private readonly baseUrl = `${API_ORIGIN}/api/v1`;
  private cache = new Map<string, CacheEntry<any>>();
  private readonly defaultTtl = 20000; // 20 seconds fresh in-memory cache

  constructor() {
    this.token = localStorage.getItem('simrt_token');
  }

  public invalidateCache(prefix?: string) {
    if (!prefix) {
      this.cache.clear();
      return;
    }
    for (const key of this.cache.keys()) {
      if (key.includes(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  public setToken(token: string | null) {
    this.token = token;
    this.invalidateCache();
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

    const activeRtId = localStorage.getItem('simrt_active_rt_id');
    if (activeRtId && !headers.has('x-rt-id')) {
      headers.set('x-rt-id', activeRtId);
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

  public async get<T>(
    endpoint: string,
    params?: Record<string, string | number | boolean | undefined>,
    options: { bypassCache?: boolean; ttlMs?: number } = {}
  ): Promise<T> {
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

    const cacheKey = `${this.token || 'anon'}:${url}`;
    const now = Date.now();
    const ttl = options.ttlMs ?? this.defaultTtl;

    if (!options.bypassCache && this.cache.has(cacheKey)) {
      const entry = this.cache.get(cacheKey)!;
      if (now - entry.timestamp < ttl) {
        return entry.data as T;
      }
    }

    const data = await this.request<T>(url, { method: 'GET' });
    this.cache.set(cacheKey, { data, timestamp: now });
    return data;
  }

  public async post<T>(endpoint: string, body?: unknown): Promise<T> {
    this.invalidateCache();
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body),
    });
  }

  public async put<T>(endpoint: string, body?: unknown): Promise<T> {
    this.invalidateCache();
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: body instanceof FormData ? body : JSON.stringify(body),
    });
  }

  public async delete<T>(endpoint: string): Promise<T> {
    this.invalidateCache();
    return this.request<T>(endpoint, {
      method: 'DELETE',
    });
  }
}

export const api = new ApiClient();
