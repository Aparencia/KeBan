"""
课伴 AI 网关 — 番茄钟推荐路由

POST /api/v1/ai/recommend-duration
调用 DeepSeek 根据用户历史专注数据推荐个性化番茄钟时长。
"""

import time
import logging
from pydantic import BaseModel, Field
from fastapi import APIRouter, Request

from config import MODEL_ROUTING, AI_PROVIDERS
from providers.deepseek_provider import DeepSeekProvider
from providers.fallback_provider import FallbackProvider
from chains.recommend_chain import RecommendChain
from errors import ProviderUnavailableError

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/ai", tags=["番茄钟推荐"])

# 初始化 Provider
_deepseek_provider: DeepSeekProvider | None = None
_fallback_provider = FallbackProvider()


def _get_deepseek_provider() -> DeepSeekProvider:
    """获取 DeepSeekProvider 单例"""
    global _deepseek_provider
    if _deepseek_provider is None:
        cfg = AI_PROVIDERS["deepseek"]
        _deepseek_provider = DeepSeekProvider(
            base_url=cfg["base_url"], api_key=cfg["api_key"]
        )
    return _deepseek_provider


# ============================================================
# 请求/响应模型
# ============================================================


class FocusSession(BaseModel):
    """单次专注记录"""
    duration_minutes: int = Field(..., description="专注时长（分钟）")
    completed: bool = Field(default=False, description="是否完成")
    subject: str = Field(default="", description="学习科目")
    timestamp: str = Field(default="", description="时间戳")


class RecommendRequest(BaseModel):
    """番茄钟推荐请求"""
    history: list[FocusSession] = Field(
        default_factory=list, description="历史专注记录"
    )


class DurationConfig(BaseModel):
    """番茄钟时长配置"""
    recommended_minutes: int = Field(..., description="推荐专注时长（分钟）")
    break_minutes: int = Field(default=5, description="推荐休息时长（分钟）")
    reason: str = Field(default="", description="推荐理由")
    source: str = Field(
        default="ai", description="推荐来源：ai/local_rule"
    )
    model: str = Field(default="", description="使用的模型名称")
    tokens_used: int = Field(default=0, description="消耗的 token 数")
    latency_ms: int = Field(default=0, description="请求耗时（毫秒）")


# ============================================================
# 路由处理
# ============================================================


@router.post(
    "/recommend-duration",
    response_model=DurationConfig,
    summary="推荐番茄钟时长",
)
async def recommend_duration(
    request: Request, body: RecommendRequest
) -> DurationConfig:
    """
    根据用户历史专注数据推荐个性化番茄钟时长

    - 使用 DeepSeek deepseek-chat 模型
    - 分析历史专注模式，给出时长建议
    - AI 不可用时降级为本地规则引擎
    """
    user_id = getattr(request.state, "user_id", "anonymous")
    logger.info(
        "番茄钟推荐请求: user=%s, history_count=%d",
        user_id, len(body.history),
    )

    # 获取模型路由配置
    provider_key, model_slot = MODEL_ROUTING["recommend"]
    model_name = AI_PROVIDERS[provider_key]["models"][model_slot]

    # 将历史记录转为 dict 列表供 chain 使用
    history_dicts = [h.model_dump() for h in body.history]

    try:
        provider = _get_deepseek_provider()
        chain = RecommendChain(provider=provider, model=model_name)
        result = await chain.run(history=history_dicts)

        return DurationConfig(
            recommended_minutes=result.get("recommended_minutes", 25),
            break_minutes=result.get("break_minutes", 5),
            reason=result.get("reason", "基于您的专注历史分析"),
            source=result.get("source", "ai"),
            model=result.get("model", model_name),
            tokens_used=result.get("tokens_used", 0),
            latency_ms=result.get("latency_ms", 0),
        )

    except Exception as e:
        # 降级：使用本地规则引擎（RecommendChain 内部也会降级，这里是双重保障）
        logger.warning("番茄钟推荐失败，使用本地规则引擎: %s", str(e))
        fallback_result = FallbackProvider.recommend_duration_fallback(history_dicts)
        return DurationConfig(
            recommended_minutes=fallback_result["recommended_minutes"],
            break_minutes=5,
            reason=fallback_result["reason"],
            source=fallback_result["source"],
            model="local_rule",
            tokens_used=0,
            latency_ms=0,
        )
