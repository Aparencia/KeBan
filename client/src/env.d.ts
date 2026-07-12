/**
 * Vite 环境变量类型声明
 *
 * 为 import.meta.env 提供精确的类型提示，
 * 仅声明项目实际使用的 VITE_ 前缀变量。
 */

/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** API 基础地址（sync-service / ai-gateway 共享前缀） */
  readonly VITE_API_BASE_URL: string;
  /** 健康检查端点完整 URL（可选，默认从 VITE_API_BASE_URL 派生） */
  readonly VITE_API_HEALTH_URL: string;
  /** Supabase 项目 URL */
  readonly VITE_SUPABASE_URL: string;
  /** Supabase 匿名公钥 */
  readonly VITE_SUPABASE_ANON_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
