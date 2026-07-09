"""
课伴 AI 网关 — 笔记摘要路由

POST /api/v1/ai/summarize
调用通义千问对学习笔记生成结构化摘要。
"""

import time
import logging
from pydantic import BaseModel, Field
from fastapi import APIRouter, Request

from config import MODEL_ROUTING, AI_PROVIDERS
from providers.qwen_provider import QwenProvider
from providers.fallback_provider import FallbackProvider
from chains.summarize_chain import SummarizeChain
from errors import ProviderUnavailableError

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/ai", tags=["笔记摘要"])

# 初始化 Provider（延迟初始化/单例模式）
_qwen_provider: QwenProvider | None = None
_fallback_provider = FallbackProvider()


def _get_qwen_provider() -> QwenProvider:
    """获取 QwenProvider 单例"""
    global _qwen_provider
    if _qwen_provider is None:
        cfg = AI_PROVIDERS["qwen"]
        _qwen_provider = QwenProvider(base_url=cfg["base_url"], api_key=cfg["api_key"])
    return _qwen_provider


# ============================================================
# 请求/响应模型
# ============================================================


class SummarizeOptions(BaseModel):
    """摘要选项"""
    max_length: int = Field(default=200, description="摘要最大字数", ge=50, le=2000)
    style: str = Field(default="bullet", description="摘要风格：bullet/paragraph/outline")
    language: str = Field(default="zh", description="输出语言")


class SummarizeRequest(BaseModel):
    """摘要请求"""
    text: str = Field(..., description="待摘要的笔记内容", min_length=10)
    options: SummarizeOptions = Field(default_factory=SummarizeOptions)


class SummarizeResponse(BaseModel):
    """摘要响应"""
    summary: str = Field(..., description="生成的摘要内容")
    model: str = Field(..., description="使用的模型名称")
    tokens_used: int = Field(..., description="消耗的 token 数")
    latency_ms: int = Field(..., description="请求耗时（毫秒）")


# ============================================================
# 路由处理
# ============================================================


@router.post("/summarize", response_model=SummarizeResponse, summary="生成笔记摘要")
async def summarize(request: Request, body: SummarizeRequest) -> SummarizeResponse:
    """
    对学习笔记生成结构化摘要

    - 使用通义千问 qwen-plus 模型
    - 支持要点列表、段落、大纲三种风格
    - 字数可配置（默认 200 字）
    """
    start_time = time.monotonic()
    user_id = getattr(request.state, "user_id", "anonymous")
    logger.info("摘要请求: user=%s, text_length=%d", user_id, len(body.text))

    # 获取模型路由配置
    provider_key, model_slot = MODEL_ROUTING["summarize"]
    model_name = AI_PROVIDERS[provider_key]["models"][model_slot]

    try:
        provider = _get_qwen_provider()
        chain = SummarizeChain(provider=provider, model=model_name)
        result = await chain.run(
            text=body.text,
            options=body.options.model_dump(),
        )
    except ProviderUnavailableError as e:
        # 降级到 FallbackProvider
        logger.warning("Qwen 不可用，使用降级响应: %s", e.message)
        result = await _fallback_provider.generate(
            prompt=body.text,
            system_prompt="你是一个专业的学习笔记摘要助手。",
        )

    latency_ms = result.get("latency_ms", int((time.monotonic() - start_time) * 1000))

    return SummarizeResponse(
        summary=result["content"],
        model=result.get("model", "unknown"),
        tokens_used=result.get("tokens_used", 0),
        latency_ms=latency_ms,
    )
