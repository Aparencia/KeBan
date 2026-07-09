"""
课伴 AI 网关 — 笔记摘要路由

POST /api/v1/ai/summarize
调用通义千问对学习笔记生成结构化摘要。
"""

import time
import logging
from pydantic import BaseModel, Field
from fastapi import APIRouter, Request

from config import call_with_fallback
from chains.summarize_chain import SummarizeChain

from fastapi import HTTPException

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/ai", tags=["笔记摘要"])


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

    # 通过 fallback 链自动选择 Provider 并在失败时重试/降级
    async def _run_chain(provider, model_name):
        chain = SummarizeChain(provider=provider, model=model_name)
        return await chain.run(
            text=body.text,
            options=body.options.model_dump(),
        )

    try:
        result, used_provider = await call_with_fallback(
            request.app, "summarize", _run_chain
        )
    except RuntimeError as e:
        logger.error("摘要服务全部不可用: %s", str(e))
        raise HTTPException(status_code=503, detail="所有 AI 服务暂时不可用，请稍后重试")

    latency_ms = result.get("latency_ms", int((time.monotonic() - start_time) * 1000))

    logger.info("摘要完成: provider=%s, model=%s", used_provider, result.get("model", "unknown"))

    return SummarizeResponse(
        summary=result["content"],
        model=result.get("model", "unknown"),
        tokens_used=result.get("tokens_used", 0),
        latency_ms=latency_ms,
    )
