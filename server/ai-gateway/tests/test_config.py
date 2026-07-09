"""
测试配置加载

覆盖：
- MODEL_ROUTING 表完整性（4 个 feature 都有映射）
- TIMEOUT_CONFIG 覆盖所有 feature
- PROVIDER_FALLBACK_CHAIN 包含 fallback Provider
- get_provider_for_feature() 返回正确的 Provider 名称和模型槽位
"""

import sys
from pathlib import Path

import pytest

# 确保 ai-gateway 根目录在 sys.path 中
GATEWAY_ROOT = str(Path(__file__).resolve().parent.parent)
if GATEWAY_ROOT not in sys.path:
    sys.path.insert(0, GATEWAY_ROOT)

from config import (
    AI_PROVIDERS,
    MODEL_ROUTING,
    TIMEOUT_CONFIG,
    PROVIDER_FALLBACK_CHAIN,
    get_provider_for_feature,
)

# 所有功能标识
ALL_FEATURES = ["summarize", "generate_cards", "evaluate", "recommend"]


# ────────────────────────────────────────────────────────────
# MODEL_ROUTING 完整性
# ────────────────────────────────────────────────────────────


class TestModelRouting:
    """MODEL_ROUTING 表完整性测试"""

    def test_all_features_present(self):
        """4 个 feature 都有映射"""
        for feature in ALL_FEATURES:
            assert feature in MODEL_ROUTING, f"feature '{feature}' 缺少 MODEL_ROUTING 映射"

    def test_mapping_format_is_tuple(self):
        """每条映射都是 (provider_key, model_slot) 二元组"""
        for feature, mapping in MODEL_ROUTING.items():
            assert isinstance(mapping, tuple), f"{feature} 映射应为 tuple"
            assert len(mapping) == 2, f"{feature} 映射应有 2 个元素"

    def test_provider_keys_valid(self):
        """映射中的 provider_key 在 AI_PROVIDERS 中存在"""
        for feature, (provider_key, _) in MODEL_ROUTING.items():
            assert provider_key in AI_PROVIDERS, (
                f"feature '{feature}' 的 provider '{provider_key}' 不在 AI_PROVIDERS 中"
            )

    def test_model_slots_valid(self):
        """映射中的 model_slot 在对应 Provider 的 models 中存在"""
        for feature, (provider_key, model_slot) in MODEL_ROUTING.items():
            models = AI_PROVIDERS.get(provider_key, {}).get("models", {})
            assert model_slot in models, (
                f"feature '{feature}' 的 model_slot '{model_slot}' "
                f"不在 provider '{provider_key}' 的 models 中"
            )


# ────────────────────────────────────────────────────────────
# TIMEOUT_CONFIG 覆盖
# ────────────────────────────────────────────────────────────


class TestTimeoutConfig:
    """TIMEOUT_CONFIG 覆盖所有 feature"""

    def test_all_features_covered(self):
        for feature in ALL_FEATURES:
            assert feature in TIMEOUT_CONFIG, f"feature '{feature}' 缺少 TIMEOUT_CONFIG"

    def test_timeout_values_positive(self):
        for feature, timeout in TIMEOUT_CONFIG.items():
            assert isinstance(timeout, int), f"{feature} 超时应为 int"
            assert timeout > 0, f"{feature} 超时应大于 0"


# ────────────────────────────────────────────────────────────
# PROVIDER_FALLBACK_CHAIN
# ────────────────────────────────────────────────────────────


class TestProviderFallbackChain:
    """PROVIDER_FALLBACK_CHAIN 包含 fallback Provider"""

    def test_all_features_covered(self):
        for feature in ALL_FEATURES:
            assert feature in PROVIDER_FALLBACK_CHAIN, (
                f"feature '{feature}' 缺少 PROVIDER_FALLBACK_CHAIN"
            )

    def test_chain_ends_with_fallback(self):
        """每个 chain 的最后一个必须是 'fallback'"""
        for feature, chain in PROVIDER_FALLBACK_CHAIN.items():
            assert chain[-1] == "fallback", (
                f"feature '{feature}' 的 fallback chain 末尾必须是 'fallback'"
            )

    def test_chain_not_empty(self):
        for feature, chain in PROVIDER_FALLBACK_CHAIN.items():
            assert len(chain) >= 2, (
                f"feature '{feature}' 的 fallback chain 至少包含主 Provider 和 fallback"
            )

    def test_primary_provider_matches_routing(self):
        """chain 的第一个 Provider 应与 MODEL_ROUTING 的主 Provider 一致"""
        for feature, chain in PROVIDER_FALLBACK_CHAIN.items():
            routing_provider = MODEL_ROUTING[feature][0]
            assert chain[0] == routing_provider, (
                f"feature '{feature}' fallback chain 主 Provider "
                f"应为 '{routing_provider}'，实际为 '{chain[0]}'"
            )


# ────────────────────────────────────────────────────────────
# get_provider_for_feature()
# ────────────────────────────────────────────────────────────


class TestGetProviderForFeature:
    """get_provider_for_feature() 返回正确的 Provider 实例和模型名"""

    def _make_app(self, providers_dict):
        """构建一个携带 providers 的 mock app"""
        from unittest.mock import MagicMock

        app = MagicMock()
        app.state.providers = providers_dict
        return app

    def test_returns_correct_provider_for_known_feature(self):
        """已知 feature 返回正确的 provider 实例和模型名"""
        mock_provider = object()
        app = self._make_app({"qwen": mock_provider, "deepseek": object()})

        provider, model_name = get_provider_for_feature(app, "summarize")
        assert provider is mock_provider
        # summarize → qwen.summary → qwen-plus
        assert model_name == "qwen-plus"

    def test_fallback_when_provider_not_initialized(self):
        """目标 Provider 未初始化时回退到 fallback"""
        fallback_provider = object()
        app = self._make_app({"fallback": fallback_provider})  # qwen 未配置

        provider, model_name = get_provider_for_feature(app, "summarize")
        assert provider is fallback_provider

    def test_unknown_feature_uses_fallback(self):
        """未知 feature 使用 fallback 路由"""
        fallback_provider = object()
        app = self._make_app({"fallback": fallback_provider})

        provider, model_name = get_provider_for_feature(app, "nonexistent_feature")
        assert provider is fallback_provider

    def test_evaluate_returns_deepseek_model(self):
        """evaluate feature 返回 deepseek-chat"""
        mock_provider = object()
        app = self._make_app({"deepseek": mock_provider})

        provider, model_name = get_provider_for_feature(app, "evaluate")
        assert provider is mock_provider
        assert model_name == "deepseek-chat"
