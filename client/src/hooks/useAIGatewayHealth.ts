import { useState, useEffect, useCallback, useRef } from 'react';
import { useSettingsStore } from '@/stores/useSettingsStore';

/** AI 网关健康状态 */
export type GatewayHealthStatus = 'online' | 'offline' | 'checking' | 'degraded';

/** 健康检测错误类型 */
export type HealthErrorType = 'timeout' | 'connection_refused' | 'cors_error' | 'server_error' | 'network_disconnected' | 'dns_error' | 'unknown';

/** Provider 状态信息 */
export interface ProviderStatus {
  status: string;
  latency_ms: number;
  error?: string;
}

/** 健康检测结果 */
interface HealthResult {
  status: GatewayHealthStatus;
  /** 响应延迟（毫秒），仅在 online/degraded 时有值 */
  latency?: number;
  /** 网关版本号，仅在 online/degraded 时有值 */
  version?: string;
  /** 错误类型，仅在 offline 时可能有值 */
  errorType?: HealthErrorType;
  /** 各 Provider 状态详情 */
  providers?: Record<string, ProviderStatus>;
  /** 健康 Provider 数量 */
  healthyCount?: number;
  /** Provider 总数 */
  totalCount?: number;
}

/** 检测超时时间（毫秒）—— quick 端点轻量检测，2s 足够 */
const HEALTH_CHECK_TIMEOUT = 2000;

/** 完整健康检测超时（毫秒）—— /health 端点需要 ping 各 Provider，预留更长时间 */
const FULL_HEALTH_CHECK_TIMEOUT = 8000;

/** 自动检测间隔（毫秒） */
const AUTO_CHECK_INTERVAL = 30_000;

// ── 模块级缓存（跨组件共享） ──
let cachedResult: HealthResult | null = null;
let cachedTimestamp = 0;
const CACHE_TTL_ONLINE = 30_000;      // 在线时 30 秒内视为有效
const CACHE_TTL_DEGRADED = 15_000;    // 降级时 15 秒内视为有效
const CACHE_TTL_OFFLINE = 5 * 60_000; // 离线时 5 分钟内视为有效，避免反复 fetch 产生控制台噪音

function getCacheTTL(): number {
  if (cachedResult?.status === 'online') return CACHE_TTL_ONLINE;
  if (cachedResult?.status === 'degraded') return CACHE_TTL_DEGRADED;
  return CACHE_TTL_OFFLINE;
}

/** 供外部调用的预检测函数（不依赖 React 生命周期） */
export function precheckGatewayHealth(): void {
  if (cachedResult && Date.now() - cachedTimestamp < getCacheTTL()) return;

  // 网络断开时直接返回，不发起无意义的请求
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    cachedResult = { status: 'offline', errorType: 'network_disconnected' };
    cachedTimestamp = Date.now();
    return;
  }

  const url = useSettingsStore.getState().aiConfig.gatewayUrl?.trim();
  if (!url) {
    cachedResult = { status: 'offline' };
    cachedTimestamp = Date.now();
    return;
  }

  const start = performance.now();
  fetch(`${url}/health/quick`, {
    method: 'GET',
    signal: AbortSignal.timeout(HEALTH_CHECK_TIMEOUT),
  })
    .then(async (res) => {
      const latency = Math.round(performance.now() - start);
      if (res.ok) {
        let version: string | undefined;
        let serverOk = false;
        try {
          const data = await res.json();
          version = data.version;
          // 验证服务端返回的 status 字段，而不仅仅依赖 HTTP 状态码
          serverOk = data.status === 'ok' || data.status === 'healthy';
        } catch {
          // 无法解析 JSON 但 HTTP 200，仍视为在线
          serverOk = true;
        }
        cachedResult = serverOk
          ? { status: 'online', latency, version }
          : { status: 'offline', errorType: 'server_error' };
      } else {
        cachedResult = { status: 'offline', errorType: 'server_error' };
      }
      cachedTimestamp = Date.now();
    })
    .catch((err) => {
      let errorType: HealthErrorType = 'unknown';
      if (err instanceof DOMException && err.name === 'AbortError') {
        errorType = 'timeout';
      } else if (err instanceof TypeError) {
        const msg = err.message.toLowerCase();
        if (msg.includes('failed to fetch') || msg.includes('networkerror')) {
          errorType = navigator.onLine ? 'connection_refused' : 'network_disconnected';
        } else if (msg.includes('cors') || msg.includes('cross-origin')) {
          errorType = 'cors_error';
        }
        // DNS 解析失败
        if (msg.includes('dns') || msg.includes('getaddrinfo') || msg.includes('name or service not known')) {
          errorType = 'dns_error';
        }
      }
      cachedResult = { status: 'offline', errorType };
      cachedTimestamp = Date.now();
    });
}

/**
 * AI 网关健康状态检测 hook
 *
 * 功能：
 * - 进入设置页面时自动检测一次
 * - 每 30 秒自动轮询（仅在页面可见时）
 * - 提供手动触发检测的方法
 */
export function useAIGatewayHealth() {
  const gatewayUrl = useSettingsStore((s) => s.aiConfig.gatewayUrl);

  // 从缓存初始化：有有效缓存则直接使用，否则为 checking
  const [result, setResult] = useState<HealthResult>(() => {
    if (cachedResult && Date.now() - cachedTimestamp < getCacheTTL()) {
      return cachedResult;
    }
    return { status: 'checking' };
  });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  /** 执行一次健康检测 */
  const checkHealth = useCallback(async (): Promise<HealthResult> => {
    // 网络断开时直接返回，不发起无意义的请求
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const offline: HealthResult = { status: 'offline', errorType: 'network_disconnected' };
      if (mountedRef.current) setResult(offline);
      return offline;
    }

    const url = gatewayUrl?.trim();
    if (!url) {
      const offline: HealthResult = { status: 'offline' };
      if (mountedRef.current) setResult(offline);
      return offline;
    }

    if (mountedRef.current) setResult({ status: 'checking' });

    // 取消上一次进行中的请求
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const start = performance.now();
    try {
      const response = await fetch(`${url}/health`, {
        method: 'GET',
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(FULL_HEALTH_CHECK_TIMEOUT)]),
      });

      const latency = Math.round(performance.now() - start);

      if (response.ok) {
        try {
          const data = await response.json();

          if (data.status === 'healthy') {
            const online: HealthResult = {
              status: 'online',
              latency,
              version: data.version,
              providers: data.providers,
              healthyCount: data.healthy_count,
              totalCount: data.total_count,
            };
            if (mountedRef.current) setResult(online);
            return online;
          } else if (data.status === 'degraded') {
            const degraded: HealthResult = {
              status: 'degraded',
              latency,
              version: data.version,
              providers: data.providers,
              healthyCount: data.healthy_count,
              totalCount: data.total_count,
            };
            if (mountedRef.current) setResult(degraded);
            return degraded;
          } else {
            // 未知状态，视为离线
            const offline: HealthResult = { status: 'offline', errorType: 'server_error' };
            if (mountedRef.current) setResult(offline);
            return offline;
          }
        } catch {
          // 无法解析 JSON 但 HTTP 200，仍视为在线（降级处理）
          const online: HealthResult = { status: 'online', latency };
          if (mountedRef.current) setResult(online);
          return online;
        }
      } else {
        const offline: HealthResult = { status: 'offline', errorType: 'server_error' };
        if (mountedRef.current) setResult(offline);
        return offline;
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return cachedResult ?? { status: 'offline', errorType: 'timeout' };
      }

      let errorType: HealthErrorType = 'unknown';
      if (err instanceof TypeError) {
        const msg = err.message.toLowerCase();
        if (msg.includes('failed to fetch') || msg.includes('networkerror')) {
          // 在线状态下 Failed to fetch 大概率是 connection refused 或 CORS
          errorType = navigator.onLine ? 'connection_refused' : 'network_disconnected';
        } else if (msg.includes('cors') || msg.includes('cross-origin')) {
          errorType = 'cors_error';
        }
        // DNS 解析失败
        if (msg.includes('dns') || msg.includes('getaddrinfo') || msg.includes('name or service not known')) {
          errorType = 'dns_error';
        }
      }

      const offline: HealthResult = { status: 'offline', errorType };
      if (mountedRef.current) setResult(offline);
      return offline;
    }
  }, [gatewayUrl]);

  /** 手动触发检测 */
  const recheck = useCallback(() => {
    void checkHealth();
  }, [checkHealth]);

  /** 挂载时检测：有有效缓存则跳过，仅启动轮询；无缓存则照常检测 */
  useEffect(() => {
    mountedRef.current = true;

    const hasValidCache = cachedResult && Date.now() - cachedTimestamp < getCacheTTL();
    if (!hasValidCache) {
      void checkHealth();
    }

    // 设置定时轮询
    intervalRef.current = setInterval(() => {
      void checkHealth();
    }, AUTO_CHECK_INTERVAL);

    // 网络恢复时立即重新检测
    const handleOnline = () => {
      void checkHealth();
    };
    // 网络断开时立即更新状态
    const handleOffline = () => {
      const offline: HealthResult = { status: 'offline', errorType: 'network_disconnected' };
      cachedResult = offline;
      cachedTimestamp = Date.now();
      if (mountedRef.current) setResult(offline);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
    }

    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
      abortRef.current = null;
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      }
    };
  }, [checkHealth]);

  return {
    /** 当前检测状态 */
    status: result.status,
    /** 响应延迟（毫秒） */
    latency: result.latency,
    /** 网关版本号 */
    version: result.version,
    /** 错误类型 */
    errorType: result.errorType,
    /** 各 Provider 状态详情 */
    providers: result.providers,
    /** 健康 Provider 数量 */
    healthyCount: result.healthyCount,
    /** Provider 总数 */
    totalCount: result.totalCount,
    /** 手动触发重新检测 */
    recheck,
  };
}
