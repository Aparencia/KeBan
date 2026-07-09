"""
课伴 AI 网关 — 抽象基类 AIProvider

所有模型 Provider 必须继承此基类并实现 generate 方法。
统一返回格式：{"content": str, "tokens_used": int, "model": str, "latency_ms": int}
"""

from abc import ABC, abstractmethod
from typing import Any


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

    async def health_check(self) -> bool:
        """检查 Provider 是否可用，子类可覆盖"""
        return True
