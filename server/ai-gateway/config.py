"""
课伴 AI 网关 — 配置模块

国产模型路由配置，支持通过环境变量覆盖。
Provider: 通义千问(Qwen) / 深度求索(DeepSeek) / 智谱(GLM)
"""

import logging
import os
from typing import Any, Callable, Awaitable

from pathlib import Path

from dotenv import load_dotenv

_env_path = Path(__file__).parent.parent / ".env"
load_dotenv(dotenv_path=_env_path)

logger = logging.getLogger(__name__)

# ============================================================
# Provider 配置
# ============================================================

AI_PROVIDERS: dict = {
    "qwen": {
        "base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1",
        "api_key": os.getenv("QWEN_API_KEY", ""),
        "models": {
            "summary": "qwen-plus",         # 笔记摘要
            "flashcard": "qwen-plus",        # 闪卡生成（JSON Mode 稳定）
            "vision": "qwen-vl-plus",        # 多模态视觉提取
            "asr": "paraformer-v2",          # 语音转文字（Paraformer）
        },
    },
    "deepseek": {
        "base_url": "https://api.deepseek.com/v1",
        "api_key": os.getenv("DEEPSEEK_API_KEY", ""),
        "models": {
            "evaluate": "deepseek-chat",     # 费曼评估
            "recommend": "deepseek-chat",    # 番茄钟推荐
        },
    },
    "glm": {
        "base_url": "https://open.bigmodel.cn/api/paas/v4",
        "api_key": os.getenv("GLM_API_KEY", ""),
        "models": {
            "free": "glm-4-flash",           # 永久免费，Alpha 验证用
            "vision": "glm-4v-flash",        # 多模态视觉（免费）
            "asr": "glm-4-audio",            # 语音转文字
        },
    },
}

# ============================================================
# 模型路由：功能 -> (provider_key, model_slot)
# ============================================================

MODEL_ROUTING: dict[str, tuple[str, str]] = {
    "summarize": ("glm", "free"),
    "generate_cards": ("glm", "free"),
    "evaluate": ("glm", "free"),
    "recommend": ("glm", "free"),
    "vision_extract": ("glm", "vision"),
    "transcribe": ("qwen", "asr"),
    "tag_content": ("glm", "free"),
    "optimize_card": ("glm", "free"),
    "feynman_question": ("deepseek", "evaluate"),
    "feynman_evaluate": ("deepseek", "evaluate"),
    "sort_inspiration": ("glm", "free"),
}

# ============================================================
# 模型路由辅助函数
# ============================================================


def get_provider_for_feature(app, feature: str):
    """
    根据 MODEL_ROUTING 表获取对应 Provider 实例和模型名称。

    如果目标 Provider 未初始化或 API Key 无效，自动回退到 GLM/fallback。

    Args:
        app: FastAPI 应用实例（通过 app.state.providers 获取 Provider）
        feature: 功能标识，对应 MODEL_ROUTING 的 key

    Returns:
        tuple: (provider_instance, model_name)
    """
    provider_key, model_slot = MODEL_ROUTING.get(feature, ("fallback", "free"))
    provider = app.state.providers.get(provider_key)
    # 检查 Provider 是否配置了有效 API Key
    if provider and not is_valid_api_key(provider.api_key):
        logger.warning("Provider [%s] API Key 无效，尝试回退到 GLM/fallback", provider_key)
        provider = None
    # 若 Provider 未初始化或 API Key 无效，尝试回退到 GLM
    if not provider:
        provider = app.state.providers.get("glm")
        provider_key = "glm"
        model_slot = "free"
    # GLM 也不可用时，使用 fallback
    if not provider:
        provider = app.state.providers.get("fallback")
        provider_key = "fallback"
        model_slot = "free"
    model_name = AI_PROVIDERS.get(provider_key, {}).get("models", {}).get(model_slot, "fallback")
    return provider, model_name


# ============================================================
# Provider Fallback 链：主 Provider 失败时依次尝试的备选
# ============================================================

PROVIDER_FALLBACK_CHAIN: dict[str, list[str]] = {
    "summarize":      ["qwen", "glm", "fallback"],       # Qwen 为主，GLM 备选
    "generate_cards": ["qwen", "glm", "fallback"],       # Qwen 为主，GLM 备选
    "evaluate":       ["deepseek", "glm", "fallback"],   # DeepSeek 为主，GLM 备选
    "recommend":      ["deepseek", "glm", "fallback"],   # DeepSeek 为主，GLM 备选
    "vision_extract": ["glm", "qwen"],                   # GLM-4V-Flash（免费）优先，Qwen-VL 备选
    "transcribe":     ["qwen", "glm", "fallback"],       # Qwen Paraformer 优先，GLM 备选
    "tag_content":    ["glm", "deepseek", "fallback"],    # GLM（免费）优先，DeepSeek 备选
    "optimize_card":  ["glm", "qwen", "fallback"],       # GLM（免费）优先，Qwen 备选
    "feynman_question": ["deepseek", "glm", "fallback"], # DeepSeek 为主，GLM 备选
    "feynman_evaluate": ["deepseek", "glm", "fallback"], # DeepSeek 为主，GLM 备选
    "sort_inspiration": ["glm", "deepseek", "fallback"], # GLM（免费）优先，DeepSeek 备选
}


async def call_with_fallback(
    app,
    feature: str,
    fn: Callable[..., Awaitable[dict[str, Any]]],
) -> tuple[dict[str, Any], str]:
    """
    使用 Provider fallback 链执行 AI 调用。

    依次尝试 PROVIDER_FALLBACK_CHAIN 中为该 feature 配置的 Provider 列表，
    每个 Provider 最多重试 2 次（由 @with_retry_and_timeout 装饰器控制）。
    所有 Provider 均失败时抛出 RuntimeError(503)。

    Args:
        app:     FastAPI 应用实例（通过 app.state.providers 获取 Provider）
        feature: 功能标识，对应 PROVIDER_FALLBACK_CHAIN 的 key
        fn:      异步可调用对象，签名为 async fn(provider, model_name) -> dict

    Returns:
        tuple: (result_dict, provider_key)

    Raises:
        RuntimeError: 所有 Provider 均不可用（status_code=503）
    """
    chain = PROVIDER_FALLBACK_CHAIN.get(feature, ["fallback"])

    for provider_key in chain:
        provider = app.state.providers.get(provider_key)
        if not provider:
            logger.warning("Provider [%s] 未初始化，跳过", provider_key)
            continue

        # 从 MODEL_ROUTING 解析模型名；fallback / 未知 feature 时使用 "fallback"
        routing = MODEL_ROUTING.get(feature)
        if routing and routing[0] == provider_key:
            model_slot = routing[1]
            model_name = AI_PROVIDERS.get(provider_key, {}).get("models", {}).get(model_slot, "fallback")
        elif routing:
            # 非主 Provider：优先使用同名 slot（如 "vision"），回退到 "free"
            feature_slot = routing[1]
            provider_models = AI_PROVIDERS.get(provider_key, {}).get("models", {})
            if feature_slot in provider_models:
                model_name = provider_models[feature_slot]
            else:
                model_name = provider_models.get("free", "fallback")
        elif provider_key == "glm":
            model_name = AI_PROVIDERS.get("glm", {}).get("models", {}).get("free", "glm-4-flash")
        else:
            model_name = "fallback"

        try:
            result = await fn(provider, model_name)
            return result, provider_key
        except Exception as e:
            logger.warning(
                "Provider [%s] failed for feature=%s: %s, trying next...",
                provider_key, feature, str(e),
            )

    # 所有 Provider 都失败
    raise RuntimeError("所有 AI 服务暂时不可用")


# ============================================================
# 超时配置（单位：秒）
# ============================================================

TIMEOUT_CONFIG: dict[str, int] = {
    "summarize": 15,
    "generate_cards": 30,
    "evaluate": 20,
    "recommend": 10,
    "vision_extract": 20,
    "transcribe": 30,
    "tag_content": 10,
    "optimize_card": 15,
    "feynman_question": 15,
    "feynman_evaluate": 15,
    "sort_inspiration": 15,
}

# ============================================================
# 频率限制（每日上限）
# ============================================================

RATE_LIMITS: dict[str, int] = {
    "daily_total": 50,
    "summarize": 15,
    "generate_cards": 10,
    "evaluate": 10,
    "recommend": 15,
    "vision_extract": 20,
    "transcribe": 30,
    "tag_content": 30,
    "optimize_card": 15,
    "feynman_question": 15,
    "feynman_evaluate": 15,
    "sort_inspiration": 20,
}

# ============================================================
# 应用配置
# ============================================================

PLACEHOLDER_PREFIXES = ("sk-your-", "your-", "change-this", "placeholder")


def is_valid_api_key(key: str) -> bool:
    """检查 API Key 是否为有效配置（非占位符）"""
    return bool(key) and not any(key.startswith(p) for p in PLACEHOLDER_PREFIXES)


APP_CONFIG = {
    "app_env": os.getenv("APP_ENV", "development"),
    "title": "课伴 AI 网关",
    "version": "0.1.0-alpha",
    "description": "课伴(KeBan) AI 增强服务网关 — MVP-2 Alpha",
    "cors_origins": [
        origin.strip()
        for origin in os.getenv(
            "CORS_ORIGINS",
            "http://localhost:5173,http://localhost:1420,tauri://localhost,http://tauri.localhost",
        ).split(",")
        if origin.strip()
    ],
    "jwt_secret": os.getenv("SUPABASE_JWT_SECRET", ""),
    "jwt_algorithm": "RS256",
    "supabase_url": os.getenv("SUPABASE_URL", ""),
    "redis_url": os.getenv("REDIS_URL", "redis://localhost:6379/0"),
}
