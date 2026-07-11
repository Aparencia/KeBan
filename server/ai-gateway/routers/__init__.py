"""课伴 AI 网关 — 路由模块"""

from routers.summarize import router as summarize_router
from routers.generate_cards import router as generate_cards_router
from routers.evaluate import router as evaluate_router
from routers.recommend import router as recommend_router
from routers.vision import router as vision_router
from routers.transcribe import router as transcribe_router
from routers.tag_content import router as tag_content_router
from routers.feynman_question import router as feynman_question_router

__all__ = [
    "summarize_router",
    "generate_cards_router",
    "evaluate_router",
    "recommend_router",
    "vision_router",
    "transcribe_router",
    "tag_content_router",
    "feynman_question_router",
]
