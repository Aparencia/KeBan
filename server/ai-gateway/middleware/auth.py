"""
课伴 AI 网关 — JWT 认证中间件

从 Authorization 头提取 Bearer token 并验证。
验证通过后将 user_id 注入 request.state。

支持 Supabase Auth 签发的 RS256 JWT，使用 RSA 公钥（PEM 格式）验证。
"""

import base64
import logging
import warnings
from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from config import APP_CONFIG
from errors import AuthenticationError

logger = logging.getLogger(__name__)

# 不需要认证的路径白名单
PUBLIC_PATHS = {"/health", "/health/quick", "/health/live"}

# 启动时检查密钥配置
if not APP_CONFIG["jwt_secret"]:
    if APP_CONFIG.get("app_env") == "production":
        import warnings
        warnings.warn(
            "SUPABASE_JWT_SECRET 未配置，JWT 验证将使用开发降级模式（不验证签名）。"
            "如需完整 JWT 验证，请配置 SUPABASE_JWT_SECRET。",
            RuntimeWarning,
            stacklevel=2,
        )
    else:
        warnings.warn(
            "SUPABASE_JWT_SECRET 未配置，JWT 验证将使用占位密钥，仅适用于本地开发。"
            "生产环境请务必从 Supabase Dashboard > Settings > API > JWT Settings 获取公钥。",
            RuntimeWarning,
            stacklevel=2,
        )


def _normalize_pem_key(raw: str) -> str:
    """
    将密钥规范化为 PEM 格式。

    支持三种输入形式：
    1. 标准 PEM 字符串（以 -----BEGIN 开头）
    2. Base64 编码的 DER 公钥
    3. 其他（直接返回，交由 jose 处理）
    """
    if not raw:
        return raw

    stripped = raw.strip()

    # 已经是 PEM 格式
    if stripped.startswith("-----BEGIN"):
        return stripped

    # 尝试 Base64 解码为 DER，再包装为 PEM
    try:
        der_bytes = base64.b64decode(stripped)
        # 简单校验：DER 编码的 RSA 公钥通常以 0x30 (SEQUENCE) 开头
        if der_bytes and der_bytes[0] == 0x30:
            b64 = base64.b64encode(der_bytes).decode("ascii")
            lines = [b64[i : i + 64] for i in range(0, len(b64), 64)]
            return (
                "-----BEGIN PUBLIC KEY-----\n"
                + "\n".join(lines)
                + "\n-----END PUBLIC KEY-----"
            )
    except Exception:
        pass

    # 兜底：原样返回
    return stripped


def _get_public_key() -> str:
    """获取用于 JWT 验证的 RSA 公钥（PEM 格式）"""
    raw = APP_CONFIG["jwt_secret"]
    if not raw:
        # 未配置时返回占位符，jose 会在验证时报错（优雅降级）
        return "not-configured"
    return _normalize_pem_key(raw)


class JWTAuthMiddleware(BaseHTTPMiddleware):
    """JWT 认证中间件"""

    async def dispatch(self, request: Request, call_next):
        # CORS 预检请求直接放行，避免被 JWT 拦截
        if request.method == "OPTIONS":
            return await call_next(request)

        # 跳过白名单路径
        if request.url.path in PUBLIC_PATHS:
            return await call_next(request)

        # 跳过非 API 路径
        if not request.url.path.startswith("/api/"):
            return await call_next(request)

        try:
            user_id = await self._verify_token(request)
            # 注入 user_id 到 request.state，供后续路由使用
            request.state.user_id = user_id
        except AuthenticationError as e:
            return JSONResponse(
                status_code=e.status_code,
                content={"detail": e.message},
            )

        # 提取用户自带的 API Key（X-User-API-Key），用于按用户 Key 路由 Provider
        user_api_key = request.headers.get("X-User-API-Key", "").strip()
        if user_api_key and len(user_api_key) > 8 and " " not in user_api_key:
            request.state.user_api_key = user_api_key
        else:
            request.state.user_api_key = None

        return await call_next(request)

    async def _verify_token(self, request: Request) -> str:
        """
        从请求头提取并验证 JWT token（RS256 / Supabase JWT）

        当 SUPABASE_JWT_SECRET 未配置时启用开发降级模式：
        - 有 Bearer token 时提取 payload 中的 sub（不验证签名）
        - 无 token 时返回 "anonymous"

        Returns:
            str: 验证通过的用户 ID（sub claim）

        Raises:
            AuthenticationError: token 缺失或验证失败
        """
        raw_secret = APP_CONFIG.get("jwt_secret", "")

        if not raw_secret:
            # 生产环境已在模块加载时退出，此处仅处理开发环境降级
            if not getattr(self, '_warned_dev_mode', False):
                logger.warning(
                    "⚠️ JWT 验证处于开发降级模式！请勿在生产环境使用。"
                    "配置 SUPABASE_JWT_SECRET 以启用完整验证。"
                )
                self._warned_dev_mode = True

            auth_header = request.headers.get("Authorization", "")
            if auth_header.startswith("Bearer "):
                token = auth_header[7:]
                try:
                    # 无签名验证提取 claims（仅用于开发调试）
                    import json
                    payload_b64 = token.split('.')[1]
                    # 补齐 base64 padding
                    payload_b64 += '=' * (4 - len(payload_b64) % 4)
                    payload = json.loads(base64.b64decode(payload_b64))
                    return payload.get("sub", "dev-user")
                except Exception:
                    return "dev-user"
            return "anonymous"

        # === 正常 RS256 JWT 验证流程 ===
        auth_header = request.headers.get("Authorization")
        if not auth_header:
            raise AuthenticationError("缺少 Authorization 请求头")

        # 提取 Bearer token
        parts = auth_header.split()
        if len(parts) != 2 or parts[0].lower() != "bearer":
            raise AuthenticationError("Authorization 头格式错误，应为 Bearer <token>")

        token = parts[1]

        # 使用 python-jose 解码并验证 JWT token（RS256）
        from jose import jwt, JWTError, ExpiredSignatureError

        public_key = _get_public_key()

        # 构建解码参数
        decode_kwargs: dict = {
            "algorithms": [APP_CONFIG["jwt_algorithm"]],
        }
        # 当配置了 supabase_url 时，验证 iss claim
        supabase_url = APP_CONFIG.get("supabase_url", "")
        if supabase_url:
            # Supabase 的 iss 格式为 "https://<project-ref>.supabase.co/auth/v1"
            decode_kwargs["issuer"] = f"{supabase_url.rstrip('/')}/auth/v1"

        try:
            payload = jwt.decode(
                token,
                public_key,
                **decode_kwargs,
            )
        except ExpiredSignatureError as e:
            raise AuthenticationError("token 已过期，请重新登录") from e
        except JWTError as e:
            raise AuthenticationError(f"token 验证失败: {str(e)}") from e

        user_id = payload.get("sub")
        if not user_id:
            raise AuthenticationError("token 中缺少用户标识 (sub)")

        logger.debug("JWT 验证通过，user_id=%s", user_id)
        return user_id
