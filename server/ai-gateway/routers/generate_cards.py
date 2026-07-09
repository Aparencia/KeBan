"""
课伴 AI 网关 — 闪卡生成路由

POST /api/v1/ai/generate-cards
调用通义千问从学习笔记中提取知识点，生成问答闪卡（JSON Mode）。
"""

import time
import logging
from pydantic import BaseModel, Field
from fastapi import APIRouter, Request

from config import MODEL_ROUTING, AI_PROVIDERS
from providers.qwen_provider import QwenProvider
from providers.fallback_provider import FallbackProvider
from chains.card_gen_chain import CardGenChain
from errors import ProviderUnavailableError, ModelResponseError

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/ai", tags=["闪卡生成"])

# 初始化 Provider
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


class CardGenOptions(BaseModel):
    """闪卡生成选项"""
    max_cards: int = Field(default=10, description="最大卡片数", ge=1, le=30)
    difficulty: str = Field(default="medium", description="难度：easy/medium/hard")
    card_type: str = Field(
        default="mixed",
        description="卡片类型：question_answer/fill_blank/true_false/mixed",
    )


class CardGenRequest(BaseModel):
    """闪卡生成请求"""
    note: str = Field(..., description="学习笔记内容", min_length=20)
    options: CardGenOptions = Field(default_factory=CardGenOptions)


class FlashCard(BaseModel):
    """单张闪卡"""
    front: str = Field(..., description="卡片正面（问题/提示）")
    back: str = Field(..., description="卡片背面（答案）")
    type: str = Field(default="question_answer", description="卡片类型")
    confidence: float = Field(default=0.8, description="提取置信度", ge=0.0, le=1.0)


class CardGenResponse(BaseModel):
    """闪卡生成响应"""
    cards: list[FlashCard] = Field(..., description="生成的闪卡列表")
    total_extracted: int = Field(..., description="提取的知识点总数")
    model: str = Field(..., description="使用的模型名称")
    tokens_used: int = Field(..., description="消耗的 token 数")


# ============================================================
# 路由处理
# ============================================================


@router.post("/generate-cards", response_model=CardGenResponse, summary="生成问答闪卡")
async def generate_cards(request: Request, body: CardGenRequest) -> CardGenResponse:
    """
    从学习笔记中提取核心知识点，生成问答闪卡

    - 使用通义千问 qwen-plus 模型 + JSON Mode
    - 支持多种卡片类型：问答、填空、判断
    - 难度可配置
    """
    user_id = getattr(request.state, "user_id", "anonymous")
    logger.info("闪卡生成请求: user=%s, note_length=%d", user_id, len(body.note))

    # 获取模型路由配置
    provider_key, model_slot = MODEL_ROUTING["generate_cards"]
    model_name = AI_PROVIDERS[provider_key]["models"][model_slot]

    try:
        provider = _get_qwen_provider()
        chain = CardGenChain(provider=provider, model=model_name)
        chain_result = await chain.run(
            note=body.note,
            options=body.options.model_dump(),
        )

        cards_data = chain_result.get("cards", [])
        total_extracted = chain_result.get("total_extracted", len(cards_data))
        model_used = chain_result.get("model", model_name)
        tokens_used = chain_result.get("tokens_used", 0)

    except (ProviderUnavailableError, ModelResponseError) as e:
        logger.warning("闪卡生成失败，使用降级响应: %s", e.message)
        cards_data = []
        total_extracted = 0
        model_used = "fallback"
        tokens_used = 0

    cards = [FlashCard(**card) for card in cards_data]

    return CardGenResponse(
        cards=cards,
        total_extracted=total_extracted,
        model=model_used,
        tokens_used=tokens_used,
    )
