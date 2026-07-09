"""
课伴 AI 网关 — GLMProvider（智谱 AI / GLM）

通过 OpenAI 兼容 SDK 调用智谱 GLM API。
- base_url: https://open.bigmodel.cn/api/paas/v4
- 模型: glm-4-flash（永久免费）
- API 格式与 OpenAI Chat Completions 兼容
- 所有 prompt 使用中文
"""

import time
import logging
from typing import Any

import openai
from openai import AsyncOpenAI

from providers.base_provider import AIProvider, with_retry_and_timeout
from errors import ProviderUnavailableError, ModelResponseError, RateLimitExceededError

logger = logging.getLogger(__name__)


class GLMProvider(AIProvider):
    """智谱 GLM Provider — glm-4-flash 免费模型"""

    def __init__(self, base_url: str, api_key: str):
        super().__init__(base_url, api_key, provider_name="glm")
        # 使用 openai SDK 的兼容模式连接智谱 GLM
        self._client = AsyncOpenAI(
            base_url=base_url,
            api_key=api_key,
        )

    @with_retry_and_timeout()
    async def generate(
        self,
        prompt: str,
        system_prompt: str = "",
        model: str = "glm-4-flash",
        temperature: float = 0.7,
        max_tokens: int = 2048,
        response_format: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """
        调用智谱 GLM 生成内容

        使用 openai 兼容 SDK 发起请求，glm-4-flash 模型永久免费。
        """
        start_time = time.monotonic()

        # 构建消息列表（中文系统提示）
        messages: list[dict[str, str]] = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        try:
            # 构建请求参数
            kwargs: dict[str, Any] = {
                "model": model,
                "messages": messages,
                "temperature": temperature,
                "max_tokens": max_tokens,
            }
            if response_format:
                kwargs["response_format"] = response_format

            response = await self._client.chat.completions.create(**kwargs)

            latency_ms = int((time.monotonic() - start_time) * 1000)

            # 提取结果
            content = response.choices[0].message.content or ""
            tokens_used = 0
            if response.usage:
                tokens_used = response.usage.total_tokens or 0

            logger.info(
                "GLMProvider 调用成功: model=%s, tokens=%d, latency=%dms",
                model, tokens_used, latency_ms,
            )

            return {
                "content": content,
                "tokens_used": tokens_used,
                "model": model,
                "latency_ms": latency_ms,
            }

        except Exception as e:
            latency_ms = int((time.monotonic() - start_time) * 1000)
            err_str = str(e).lower()
            logger.error("GLMProvider 调用失败: %s (耗时 %dms)", str(e), latency_ms)

            # 错误分类处理
            if isinstance(e, openai.APITimeoutError) or "timeout" in err_str:
                logger.warning("GLMProvider 网络超时")
                raise ProviderUnavailableError("glm", f"网络超时: {e}") from e

            if isinstance(e, openai.RateLimitError) or "rate_limit" in err_str or "429" in err_str:
                logger.warning("GLMProvider 触发频率限制")
                raise RateLimitExceededError("glm", 0) from e

            if isinstance(e, openai.APIConnectionError) or "connection" in err_str:
                logger.warning("GLMProvider 连接失败")
                raise ProviderUnavailableError("glm", f"连接失败: {e}") from e

            if "content" in err_str and ("filter" in err_str or "policy" in err_str or "审核" in err_str):
                logger.warning("GLMProvider 内容审核拦截")
                raise ModelResponseError(model, "内容未通过安全审核") from e

            raise ModelResponseError(model, str(e)) from e
