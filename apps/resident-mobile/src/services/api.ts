import type { ApiResponse } from '@simrt/shared-types';

class MobileApiClient {
  private baseUrl: string = '/api/v1';
  private token: string | null = null;

  constructor() {
    this.token = localStorage.getItem('simrt_mobile_access_token');
  }

  public setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('simrt_mobile_access_token', token);
    } else {
      localStorage.removeItem('simrt_mobile_access_token');
    }
  }

  public getToken(): string | null {
    return this.token;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = new Headers(options.headers || {});

    if (this.token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${this.token}`);
    }

    if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const json: ApiResponse<T> = await response.json();

      if (!response.ok || !json.success) {
        if (response.status === 401) {
          this.setToken(null);
          localStorage.removeItem('simrt_mobile_user');
          window.dispatchEvent(new CustomEvent('simrt_unauthorized'));
        }
        const error = new Error(json.error?.message || 'Permintaan gagal diproses') as any;
        error.code = json.error?.code || 'API_ERROR';
        error.status = response.status;
        throw error;
      }

      return json.data as T;
    } catch (err: any) {
      if (err.status) throw err;
      throw new Error(err.message || 'Gagal terhubung ke server RT. Periksa koneksi internet Anda.');
    }
  }

  public async get<T>(endpoint: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
    let url = endpoint;
    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== '') {
          searchParams.append(key, String(val));
        }
      });
      const qs = searchParams.toString();
      if (qs) {
        url += (url.includes('?') ? '&' : '?') + qs;
      }
    }
    return this.request<T>(url, { method: 'GET' });
  }

  public async post<T>(endpoint: string, body?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  public async upload<T>(endpoint: string, formData: FormData): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: formData,
    });
  }
}

export const mobileApi = new MobileApiClient();
