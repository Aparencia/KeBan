"""
课伴 AI 网关 — 频率限制中间件

基于 Redis 的滑动窗口频率限制：
- 按 user_id + feature 计数
- 双层计数器：全局每日上限 + 功能级上限
- Redis 不可用时放行（降级到无限制）
- 超限返回 HTTP 429
"""

import logging
from datetime import datetime

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from cache.redis_cache import get_cache
from config import RATE_LIMITS

logger = logging.getLogger(__name__)

# API 路径到功能名称的映射
PATH_TO_FEATURE: dict[str, str] = {
    "/api/v1/ai/summarize": "summarize",
    "/api/v1/ai/generate-cards": "generate_cards",
    "/api/v1/ai/evaluate-explanation": "evaluate",
    "/api/v1/ai/recommend-duration": "recommend",
    "/api/v1/ai/vision": "vision_extract",
    "/api/v1/ai/transcribe": "transcribe",
    "/api/v1/ai/tag-content": "tag_content",
    "/api/v1/ai/optimize-card": "optimize_card",
    "/api/v1/ai/feynman-question": "feynman_question",
    "/api/v1/ai/feynman-evaluate-answers": "feynman_evaluate",
}


class RateLimitMiddleware(BaseHTTPMiddleware):
    """频率限制中间件 — 基于 Redis 滑动窗口"""

    async def dispatch(self, request: Request, call_next):
        # 仅对 AI 功能 API 进行频率限制
        feature = PATH_TO_FEATURE.get(request.url.path)
        if not feature:
            return await call_next(request)

        # 获取 user_id（由 JWT 中间件注入）
        user_id = getattr(request.state, "user_id", "anonymous")

        # 检查频率限制
        is_allowed, detail = await self._check_rate_limit(user_id, feature)
        if not is_allowed:
            return JSONResponse(
                status_code=429,
                content={
                    "detail": detail,
                    "feature": feature,
                },
            )

        return await call_next(request)

    async def _check_rate_limit(
        self, user_id: str, feature: str
    ) -> tuple[bool, str]:
        """
        检查用户是否超出频率限制（双层计数器）

        检查顺序：
        1. 功能级每日限制（如 summarize 每日 15 次）
        2. 全局每日总量限制（每日 50 次）

        Redis 不可用时跳过检查，直接放行。

        Args:
            user_id: 用户 ID
            feature: 功能名称

        Returns:
            tuple: (是否允许, 拒绝原因)
        """
        cache = get_cache()
        if not cache._client:
            # Redis 不可用，降级放行
            logger.debug("频率限制检查: user=%s, feature=%s (Redis 不可用，放行)", user_id, feature)
            return True, ""

        today = datetime.now().strftime("%Y-%m-%d")

        # 从配置读取限额
        feature_limit = RATE_LIMITS.get(feature, 10)
        daily_limit = RATE_LIMITS.get("daily_total", 50)

        # 计算到当日结束的剩余秒数（至少 60 秒，避免边界问题）
        now = datetime.now()
        seconds_until_end_of_day = (
            (24 - now.hour) * 3600
            - now.minute * 60
            - now.second
        )
        ttl = max(seconds_until_end_of_day, 60)

        # ---- 第一层：功能级限制 ----
        feature_key = f"rate_limit:{user_id}:{feature}:{today}"
        try:
            feature_count = await cache.increment(feature_key, expire=ttl)
        except Exception as exc:
            logger.warning("频率限制计数失败(功能级): %s", exc)
            return True, ""  # Redis 异常，降级放行

        if feature_count > feature_limit:
            return False, (
                f"「{feature}」今日使用次数已达上限（{feature_limit} 次/天），"
                "请明天再试，或升级套餐获取更多配额。"
            )

        # ---- 第二层：全局每日总量限制 ----
        global_key = f"rate_limit:{user_id}:global:{today}"
        try:
            global_count = await cache.increment(global_key, expire=ttl)
        except Exception as exc:
            logger.warning("频率限制计数失败(全局): %s", exc)
            return True, ""  # Redis 异常，降级放行

        if global_count > daily_limit:
            return False, (
                f"今日 AI 功能总使用次数已达上限（{daily_limit} 次/天），"
                "请明天再试，或升级套餐获取更多配额。"
            )

        logger.debug(
            "频率限制通过: user=%s, feature=%s, feature_count=%d/%d, global_count=%d/%d",
            user_id, feature, feature_count, feature_limit, global_count, daily_limit,
        )
        return True, ""
