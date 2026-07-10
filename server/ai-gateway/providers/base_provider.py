"""
课伴 AI 网关 — 抽象基类 AIProvider

所有模型 Provider 必须继承此基类并实现 generate 方法。
统一返回格式：{"content": str, "tokens_used": int, "model": str, "latency_ms": int}
"""

import asyncio
import logging
from abc import ABC, abstractmethod
from functools import wraps
from typing import Any

from config import TIMEOUT_CONFIG

logger = logging.getLogger(__name__)


def with_retry_and_timeout(max_retries: int = 2):
    """装饰器：为 Provider 方法添加超时控制和重试逻辑

    使用 TIMEOUT_CONFIG 中按 feature 配置的超时时间。
    失败时最多重试 max_retries 次，每次重试间隔指数退避。

    用法：在 Provider 子类的 generate 方法上添加 @with_retry_and_timeout()
    若调用方传入了 _feature 关键字参数，则使用该 feature 对应的超时时间；
    否则取 TIMEOUT_CONFIG 中的最大值作为安全上限。
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(self, *args, **kwargs):
            # 从 kwargs 推断 feature 名称（由 chain 层传入）
            feature = kwargs.pop('_feature', '')
            if feature and feature in TIMEOUT_CONFIG:
                timeout = TIMEOUT_CONFIG[feature]
            else:
                # 未指定 feature 时取配置最大值，确保不会误杀慢请求
                timeout = max(TIMEOUT_CONFIG.values()) if TIMEOUT_CONFIG else 30

            last_error: Exception | None = None
            for attempt in range(max_retries + 1):
                try:
                    result = await asyncio.wait_for(
                        func(self, *args, **kwargs),
                        timeout=timeout
                    )
                    return result
                except asyncio.TimeoutError as e:
                    last_error = e
                    logger.warning(
                        "Provider %s timeout (attempt %d/%d, feature=%s, timeout=%ds)",
                        self.__class__.__name__, attempt + 1, max_retries + 1,
                        feature or "unknown", timeout
                    )
                except Exception as e:
                    last_error = e
                    logger.warning(
                        "Provider %s error (attempt %d/%d): %s",
                        self.__class__.__name__, attempt + 1, max_retries + 1, str(e)
                    )

                if attempt < max_retries:
                    await asyncio.sleep(2 ** attempt)  # 指数退避: 1s, 2s

            raise last_error  # type: ignore[misc]
        return wrapper
    return decorator


class AIProvider(ABC):
    """AI 模型 Provider 抽象基类"""

    def __init__(self, base_url: str, api_key: str, provider_name: str):
        self.base_url = base_url
        self.api_key = api_key
        self.provider_name = provider_name

    @abstractmethod
    async def generate(
        self,
        prompt: str,
        system_prompt: str = "",
        model: str = "",
        temperature: float = 0.7,
        max_tokens: int = 2048,
        response_format: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """
        调用模型生成内容

        Args:
            prompt: 用户提示词
            system_prompt: 系统提示词（角色设定）
            model: 模型名称（覆盖默认值）
            temperature: 温度参数，控制随机性
            max_tokens: 最大生成 token 数
            response_format: 响应格式约束，如 {"type": "json_object"}

        Returns:
            dict: {
                "content": str,       # 生成的文本内容
                "tokens_used": int,   # 消耗的总 token 数
                "model": str,         # 实际使用的模型名
                "latency_ms": int,    # 请求耗时（毫秒）
            }
        """
        ...

    async def generate_vision(
        self,
        image_base64: str,
        prompt: str,
        system_prompt: str = "",
        model: str = "",
        temperature: float = 0.3,
        max_tokens: int = 2048,
        response_format: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """
        调用多模态视觉模型处理图片

        默认实现抛出 NotImplementedError，由支持视觉的 Provider 子类覆盖。

        Args:
            image_base64: 图片 base64 编码（不含 data: 前缀）
            prompt: 文本提示词
            system_prompt: 系统提示词
            model: 模型名称
            temperature: 温度参数
            max_tokens: 最大生成 token 数
            response_format: 响应格式约束

        Returns:
            dict: 与 generate 相同的统一返回格式
        """
        raise NotImplementedError(
            f"{self.__class__.__name__} 不支持多模态视觉调用"
        )

    @abstractmethod
    async def transcribe(
        self,
        audio_base64: str,
        language: str = "zh",
        sample_rate: int = 16000,
        channels: int = 1,
        model: str = "",
    ) -> dict[str, Any]:
        """
        语音转文字

        默认实现抛出 NotImplementedError，由支持 ASR 的 Provider 子类覆盖。

        Args:
            audio_base64: PCM/WAV 音频 base64 编码
            language: 语言代码（zh/en/auto）
            sample_rate: 采样率
            channels: 声道数
            model: 模型名称

        Returns:
            dict: {
                "text": str,             # 转写文本
                "segments": list[dict],   # [{start, end, text}]
                "language": str,          # 检测到的语言
                "confidence": float,      # 置信度 0-1
                "model": str,             # 实际使用的模型名
                "latency_ms": int,        # 请求耗时（毫秒）
            }
        """
        raise NotImplementedError(
            f"{self.__class__.__name__} 不支持语音转文字"
        )

    async def health_check(self) -> dict:
        """
        检查 Provider 实际可用性

        发送一个最小请求（如 "ping"）并测量响应时间。
        返回: {"status": "healthy"|"unhealthy", "latency_ms": float, "error": str|None}
        """
        import time
        start = time.monotonic()
        try:
            await self.generate("ping", max_tokens=5, _feature="health_check")
            latency = (time.monotonic() - start) * 1000
            return {"status": "healthy", "latency_ms": round(latency, 1), "error": None}
        except Exception as e:
            latency = (time.monotonic() - start) * 1000
            return {"status": "unhealthy", "latency_ms": round(latency, 1), "error": str(e)}
