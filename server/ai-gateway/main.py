"""
课伴 AI 网关 — FastAPI 应用入口

MVP-2 Alpha 阶段的 AI 增强服务网关。
- CORS 中间件（开发阶段允许所有来源）
- JWT 认证中间件
- 频率限制中间件
- 健康检查端点
- 全局异常处理器
"""

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from starlette.responses import Response

from config import APP_CONFIG
from errors import AIError
from middleware.auth import JWTAuthMiddleware
from middleware.rate_limit import RateLimitMiddleware
from routers import (
    summarize_router,
    generate_cards_router,
    evaluate_router,
    recommend_router,
)
from cache.redis_cache import get_cache

# ============================================================
# 日志配置
# ============================================================

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


# ============================================================
# 应用生命周期
# ============================================================


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 启动时
    logger.info("课伴 AI 网关启动中...")
    logger.info("版本: %s", APP_CONFIG["version"])

    # 初始化 Redis 连接
    cache = get_cache()
    await cache.connect()
    logger.info("Redis 连接已建立")

    # 初始化各 Provider 并检查 API Key 配置
    from config import AI_PROVIDERS
    from providers.qwen_provider import QwenProvider
    from providers.deepseek_provider import DeepSeekProvider
    from providers.glm_provider import GLMProvider
    from providers.fallback_provider import FallbackProvider

    # 将 Provider 实例存储到 app.state，供路由层使用
    app.state.providers = {}

    qwen_cfg = AI_PROVIDERS.get("qwen", {})
    if qwen_cfg.get("api_key"):
        app.state.providers["qwen"] = QwenProvider(
            base_url=qwen_cfg["base_url"],
            api_key=qwen_cfg["api_key"],
        )
        logger.info("Provider [qwen]: 已初始化")
    else:
        logger.warning("Provider [qwen]: API Key 未配置，跳过初始化")

    deepseek_cfg = AI_PROVIDERS.get("deepseek", {})
    if deepseek_cfg.get("api_key"):
        app.state.providers["deepseek"] = DeepSeekProvider(
            base_url=deepseek_cfg["base_url"],
            api_key=deepseek_cfg["api_key"],
        )
        logger.info("Provider [deepseek]: 已初始化")
    else:
        logger.warning("Provider [deepseek]: API Key 未配置，跳过初始化")

    glm_cfg = AI_PROVIDERS.get("glm", {})
    if glm_cfg.get("api_key"):
        app.state.providers["glm"] = GLMProvider(
            base_url=glm_cfg["base_url"],
            api_key=glm_cfg["api_key"],
        )
        logger.info("Provider [glm]: 已初始化")
    else:
        logger.warning("Provider [glm]: API Key 未配置，跳过初始化")
    
    # FallbackProvider 始终可用
    app.state.providers["fallback"] = FallbackProvider()
    logger.info("Provider [fallback]: 已初始化（降级兜底）")

    for name, cfg in AI_PROVIDERS.items():
        has_key = bool(cfg["api_key"])
        status = "已配置" if has_key else "未配置（API Key 缺失）"
        logger.info("Provider [%s]: %s", name, status)

    yield

    # 关闭时
    logger.info("课伴 AI 网关关闭中...")
    # 关闭 Redis 连接
    cache = get_cache()
    await cache.disconnect()
    logger.info("Redis 连接已关闭")


# ============================================================
# FastAPI 应用实例
# ============================================================

app = FastAPI(
    title=APP_CONFIG["title"],
    version=APP_CONFIG["version"],
    description=APP_CONFIG["description"],
    lifespan=lifespan,
)


# ============================================================
# 中间件注册（注意：中间件执行顺序与注册顺序相反）
# ============================================================

# 安全头中间件（注册在最前，因此在 CORS 之后执行，为每个响应添加安全头）
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response: Response = await call_next(request)
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response

# CORS 中间件（最外层）
app.add_middleware(
    CORSMiddleware,
    allow_origins=APP_CONFIG["cors_origins"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# JWT 认证中间件
app.add_middleware(JWTAuthMiddleware)

# 频率限制中间件
app.add_middleware(RateLimitMiddleware)


# ============================================================
# 全局异常处理器
# ============================================================


@app.exception_handler(AIError)
async def ai_error_handler(request: Request, exc: AIError) -> JSONResponse:
    """将 AIError 映射为对应的 HTTP 状态码"""
    logger.warning(
        "AIError: %s (status=%d, path=%s)",
        exc.message, exc.status_code, request.url.path,
    )
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "detail": exc.message,
            **exc.detail,
        },
    )


# ============================================================
# 健康检查端点
# ============================================================


@app.get("/health", tags=["系统"])
async def health_check():
    """
    健康检查端点

    对每个 Provider 发送 ping 测试，记录响应时间和可用性。
    """
    providers_status = {}

    for name, provider in app.state.providers.items():
        try:
            # 实际 ping 测试（带 5 秒超时）
            result = await asyncio.wait_for(provider.health_check(), timeout=5.0)
            providers_status[name] = result
        except asyncio.TimeoutError:
            providers_status[name] = {"status": "unhealthy", "latency_ms": 5000, "error": "health check timeout"}

    # Redis 连接状态检查
    redis_status = "not_connected"
    try:
        cache = get_cache()
        if cache._client is not None:
            await cache._client.ping()
            redis_status = "connected"
    except Exception as e:
        redis_status = f"error: {str(e)}"

    # 整体健康状态
    healthy_providers = sum(1 for p in providers_status.values() if p.get("status") == "healthy")
    overall = "healthy" if healthy_providers > 0 else "degraded"

    return {
        "status": overall,
        "version": APP_CONFIG["version"],
        "providers": providers_status,
        "redis": redis_status,
        "healthy_count": healthy_providers,
        "total_count": len(providers_status),
    }


@app.get("/health/live", tags=["系统"])
async def liveness():
    """K8s liveness probe — 仅检查进程存活"""
    return {"status": "alive"}


# ============================================================
# 注册路由
# ============================================================

app.include_router(summarize_router)
app.include_router(generate_cards_router)
app.include_router(evaluate_router)
app.include_router(recommend_router)


# ============================================================
# 启动入口（开发用）
# ============================================================

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,  # 开发模式热重载
    )
