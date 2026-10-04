export type ApiError = {
  code: string;
  message: string;
};

class ApiClient {
  private baseUrl = '/api';

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...init.headers,
      },
    });

    if (res.status === 401) {
      // Try to refresh tokens
      const refreshRes = await fetch(`${this.baseUrl}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });

      if (refreshRes.ok) {
        // Retry the original request
        const retryRes = await fetch(`${this.baseUrl}${path}`, {
          ...init,
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            ...init.headers,
          },
        });

        if (!retryRes.ok) {
          const error = await retryRes.json().catch(() => ({ error: { code: 'UNKNOWN', message: 'Unknown error' } }));
          throw new Error(error.error?.message ?? 'Request failed');
        }

        return retryRes.json() as Promise<T>;
      } else {
        // Refresh failed — user needs to log in
        window.location.href = '/login';
        throw new Error('Session expired');
      }
    }

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: { code: 'UNKNOWN', message: 'Unknown error' } }));
      const err = new Error(error.error?.message ?? 'Request failed') as Error & { code?: string };
      err.code = error.error?.code;
      throw err;
    }

    if (res.status === 204) return undefined as T;

    return res.json() as Promise<T>;
  }

  get<T>(path: string, headers?: Record<string, string>) {
    return this.request<T>(path, { method: 'GET', headers });
  }

  post<T>(path: string, body?: unknown, headers?: Record<string, string>) {
    return this.request<T>(path, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
      headers,
    });
  }

  put<T>(path: string, body?: unknown, headers?: Record<string, string>) {
    return this.request<T>(path, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
      headers,
    });
  }

  patch<T>(path: string, body?: unknown, headers?: Record<string, string>) {
    return this.request<T>(path, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
      headers,
    });
  }

  delete<T>(path: string, headers?: Record<string, string>) {
    return this.request<T>(path, { method: 'DELETE', headers });
  }
}

export const api = new ApiClient();
