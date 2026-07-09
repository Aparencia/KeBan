"""
课伴 AI 网关 — 配置模块

国产模型路由配置，支持通过环境变量覆盖。
Provider: 通义千问(Qwen) / 深度求索(DeepSeek) / 智谱(GLM)
"""

import os
from dotenv import load_dotenv

load_dotenv()

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
        },
    },
}

# ============================================================
# 模型路由：功能 -> (provider_key, model_slot)
# ============================================================

MODEL_ROUTING: dict[str, tuple[str, str]] = {
    "summarize": ("qwen", "summary"),
    "generate_cards": ("qwen", "flashcard"),
    "evaluate": ("deepseek", "evaluate"),
    "recommend": ("deepseek", "recommend"),
}

# ============================================================
# 超时配置（单位：秒）
# ============================================================

TIMEOUT_CONFIG: dict[str, int] = {
    "summarize": 15,
    "generate_cards": 30,
    "evaluate": 20,
    "recommend": 10,
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
}

# ============================================================
# 应用配置
# ============================================================

APP_CONFIG = {
    "title": "课伴 AI 网关",
    "version": "0.1.0-alpha",
    "description": "课伴(KeBan) AI 增强服务网关 — MVP-2 Alpha",
    "cors_origins": ["*"],  # 开发阶段允许所有来源
    "jwt_secret": os.getenv("JWT_SECRET", "dev-secret-change-me"),
    "jwt_algorithm": "HS256",
    "redis_url": os.getenv("REDIS_URL", "redis://localhost:6379/0"),
}
