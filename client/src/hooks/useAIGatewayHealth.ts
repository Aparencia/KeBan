import { useState, useEffect, useCallback, useRef } from 'react';
import { useSettingsStore } from '@/stores/useSettingsStore';

/** AI 网关健康状态 */
export type GatewayHealthStatus = 'online' | 'offline' | 'checking';

/** 健康检测结果 */
interface HealthResult {
  status: GatewayHealthStatus;
  /** 响应延迟（毫秒），仅在 online 时有值 */
  latency?: number;
  /** 网关版本号，仅在 online 时有值 */
  version?: string;
}

/** 检测超时时间（毫秒）—— 本地网关通常 < 200ms 响应，2s 足够 */
const HEALTH_CHECK_TIMEOUT = 2000;

/** 自动检测间隔（毫秒） */
const AUTO_CHECK_INTERVAL = 30_000;

// ── 模块级缓存（跨组件共享） ──
let cachedResult: HealthResult | null = null;
let cachedTimestamp = 0;
const CACHE_TTL_ONLINE = 30_000;   // 在线时 30 秒内视为有效
const CACHE_TTL_OFFLINE = 5 * 60_000; // 离线时 5 分钟内视为有效，避免反复 fetch 产生控制台噪音

function getCacheTTL(): number {
  return cachedResult?.status === 'online' ? CACHE_TTL_ONLINE : CACHE_TTL_OFFLINE;
}

/** 供外部调用的预检测函数（不依赖 React 生命周期） */
export function precheckGatewayHealth(): void {
  if (cachedResult && Date.now() - cachedTimestamp < getCacheTTL()) return;

  const url = useSettingsStore.getState().aiConfig.gatewayUrl?.trim();
  if (!url) {
    cachedResult = { status: 'offline' };
    cachedTimestamp = Date.now();
    return;
  }

  const start = performance.now();
  fetch(`${url}/health`, {
    method: 'GET',
    signal: AbortSignal.timeout(HEALTH_CHECK_TIMEOUT),
  })
    .then(async (res) => {
      const latency = Math.round(performance.now() - start);
      if (res.ok) {
        let version: string | undefined;
        try { const data = await res.json(); version = data.version; } catch { /* ignore */ }
        cachedResult = { status: 'online', latency, version };
      } else {
        cachedResult = { status: 'offline' };
      }
      cachedTimestamp = Date.now();
    })
    .catch(() => {
      cachedResult = { status: 'offline' };
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
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(HEALTH_CHECK_TIMEOUT)]),
      });

      const latency = Math.round(performance.now() - start);

      if (response.ok) {
        let version: string | undefined;
        try {
          const data = await response.json();
          version = data.version;
        } catch {
          /* 非 JSON 响应也视为在线 */
        }
        const online: HealthResult = { status: 'online', latency, version };
        if (mountedRef.current) setResult(online);
        return online;
      } else {
        const offline: HealthResult = { status: 'offline' };
        if (mountedRef.current) setResult(offline);
        return offline;
      }
    } catch (err) {
      // AbortError 是主动取消，不需要更新状态
      if (err instanceof DOMException && err.name === 'AbortError') {
        return cachedResult ?? { status: 'offline' };
      }
      const offline: HealthResult = { status: 'offline' };
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

    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
      abortRef.current = null;
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
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
    /** 手动触发重新检测 */
    recheck,
  };
}
