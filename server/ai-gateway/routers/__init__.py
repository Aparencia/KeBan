"""课伴 AI 网关 — 路由模块"""

from routers.summarize import router as summarize_router
from routers.generate_cards import router as generate_cards_router
from routers.evaluate import router as evaluate_router
from routers.recommend import router as recommend_router

__all__ = [
    "summarize_router",
    "generate_cards_router",
    "evaluate_router",
    "recommend_router",
]
