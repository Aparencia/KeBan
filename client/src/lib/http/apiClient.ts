import { supabase } from '../auth/supabaseClient';
import { getAIConfig } from '../ai/config';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

interface RequestOptions extends RequestInit {
  timeout?: number;
}

function createClient(baseUrlOrGetter: string | (() => string)) {
  const resolveUrl = typeof baseUrlOrGetter === 'function' ? baseUrlOrGetter : () => baseUrlOrGetter;

  async function request<T = unknown>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { timeout = 30000, headers: customHeaders, ...rest } = options;
    const baseUrl = resolveUrl();

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
      const response = await fetch(`${baseUrl}${endpoint}`, {
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
          const retryResponse = await fetch(`${baseUrl}${endpoint}`, {
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

  return {
    get: <T = unknown>(url: string) => request<T>(url, { method: 'GET' }),
    post: <T = unknown>(url: string, body?: unknown) =>
      request<T>(url, { method: 'POST', body: JSON.stringify(body) }),
    put: <T = unknown>(url: string, body?: unknown) =>
      request<T>(url, { method: 'PUT', body: JSON.stringify(body) }),
    delete: <T = unknown>(url: string) => request<T>(url, { method: 'DELETE' }),
  };
}

/** sync-service 客户端（:8080） */
export const apiClient = createClient(API_BASE_URL);

/** ai-gateway 客户端（URL 从 localStorage 配置动态读取） */
export const aiClient = createClient(() => getAIConfig().gatewayUrl);
