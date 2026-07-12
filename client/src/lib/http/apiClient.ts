import { supabase } from '../auth/supabaseClient';
import { requireGatewayUrl } from '../ai/config';
import { getActiveUserKey } from '../ai/apiKeyManager';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

interface RequestOptions extends RequestInit {
  timeout?: number;
}

function createClient(baseUrlOrGetter: string | (() => string)) {
  const resolveUrl = typeof baseUrlOrGetter === 'function' ? baseUrlOrGetter : () => baseUrlOrGetter;

  async function request<T = unknown>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { timeout = 30000, headers: customHeaders, ...rest } = options;
    const baseUrl = resolveUrl();

    if (!baseUrl) {
      throw new Error('[KeBan] API base URL not configured. Please set VITE_API_BASE_URL in .env');
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;

    const headers = new Headers(customHeaders as HeadersInit);
    if (token) headers.set('Authorization', `Bearer ${token}`);
    headers.set('Content-Type', 'application/json');

    // 用户自配置 API Key 时附加 X-User-API-Key header
    const userKey = getActiveUserKey();
    if (userKey) headers.set('X-User-API-Key', userKey);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(`${baseUrl}${endpoint}`, {
        ...rest,
        headers,
        signal: controller.signal,
      });

      // 401 → 尝试强制刷新 token 并重试一次
      if (response.status === 401) {
        const { data: { session: refreshed }, error: refreshError } = await supabase.auth.refreshSession();

        // 刷新失败（包括 refresh token 过期）→ 派发 session-expired 事件引导重登
        if (refreshError || !refreshed?.access_token) {
          window.dispatchEvent(new CustomEvent('kb:session-expired'));
          throw new Error('HTTP 401: 登录已过期');
        }

        // 拿到新 token，重试原请求
        if (refreshed.access_token !== token) {
          headers.set('Authorization', `Bearer ${refreshed.access_token}`);
          const retryResponse = await fetch(`${baseUrl}${endpoint}`, {
            ...rest,
            headers,
            signal: controller.signal,
          });

          // 重试仍失败 → 同样派发 session-expired
          if (!retryResponse.ok) {
            window.dispatchEvent(new CustomEvent('kb:session-expired'));
            throw new Error(`HTTP ${retryResponse.status}`);
          }
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
export const aiClient = createClient(() => {
  try {
    return requireGatewayUrl();
  } catch {
    return ''; // request() will throw a clear error
  }
});
