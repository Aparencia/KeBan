"""
课伴 AI 网关 — FastAPI 应用入口

MVP-2 Alpha 阶段的 AI 增强服务网关。
- CORS 中间件（开发阶段允许所有来源）
- JWT 认证中间件
- 频率限制中间件
- 健康检查端点
- 全局异常处理器
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

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

    返回服务状态、各 Provider 可用性、Redis 连接状态。
    """
    from config import AI_PROVIDERS

    providers_status = {}
    for name, cfg in AI_PROVIDERS.items():
        providers_status[name] = {
            "configured": bool(cfg["api_key"]),
            "base_url": cfg["base_url"],
        }

    # Redis 连接状态检查
    redis_status = "not_connected"
    try:
        cache = get_cache()
        if cache._client is not None:
            await cache._client.ping()
            redis_status = "connected"
    except Exception as e:
        redis_status = f"error: {str(e)}"

    return {
        "status": "healthy",
        "version": APP_CONFIG["version"],
        "providers": providers_status,
        "redis": redis_status,
    }


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
