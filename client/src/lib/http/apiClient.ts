import { supabase } from '../auth/supabaseClient';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

interface RequestOptions extends RequestInit {
  timeout?: number;
}

async function request<T = unknown>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { timeout = 30000, headers: customHeaders, ...rest } = options;

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;

  const headers = new Headers(customHeaders as HeadersInit);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  headers.set('Content-Type', 'application/json');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...rest,
      headers,
      signal: controller.signal,
    });

    // 401 → attempt silent token refresh and retry once
    if (response.status === 401) {
      const {
        data: { session: refreshed },
      } = await supabase.auth.getSession();
      if (refreshed?.access_token && refreshed.access_token !== token) {
        headers.set('Authorization', `Bearer ${refreshed.access_token}`);
        const retryResponse = await fetch(`${API_BASE_URL}${endpoint}`, {
          ...rest,
          headers,
          signal: controller.signal,
        });
        if (!retryResponse.ok) throw new Error(`HTTP ${retryResponse.status}`);
        return retryResponse.json() as Promise<T>;
      }
    }

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json() as Promise<T>;
  } finally {
    clearTimeout(timeoutId);
  }
}

export const apiClient = {
  get: <T = unknown>(url: string) => request<T>(url, { method: 'GET' }),
  post: <T = unknown>(url: string, body?: unknown) =>
    request<T>(url, { method: 'POST', body: JSON.stringify(body) }),
  put: <T = unknown>(url: string, body?: unknown) =>
    request<T>(url, { method: 'PUT', body: JSON.stringify(body) }),
  delete: <T = unknown>(url: string) => request<T>(url, { method: 'DELETE' }),
};
