"""
课伴 AI 网关 — JWT 认证中间件

从 Authorization 头提取 Bearer token 并验证。
验证通过后将 user_id 注入 request.state。
"""

import logging
from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from config import APP_CONFIG
from errors import AuthenticationError

logger = logging.getLogger(__name__)

# 不需要认证的路径白名单
PUBLIC_PATHS = {"/health", "/docs", "/openapi.json", "/redoc"}


class JWTAuthMiddleware(BaseHTTPMiddleware):
    """JWT 认证中间件"""

    async def dispatch(self, request: Request, call_next):
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

        return await call_next(request)

    async def _verify_token(self, request: Request) -> str:
        """
        从请求头提取并验证 JWT token

        Returns:
            str: 验证通过的用户 ID

        Raises:
            AuthenticationError: token 缺失或验证失败
        """
        auth_header = request.headers.get("Authorization")
        if not auth_header:
            raise AuthenticationError("缺少 Authorization 请求头")

        # 提取 Bearer token
        parts = auth_header.split()
        if len(parts) != 2 or parts[0].lower() != "bearer":
            raise AuthenticationError("Authorization 头格式错误，应为 Bearer <token>")

        token = parts[1]

        # 使用 python-jose 解码并验证 JWT token
        from jose import jwt, JWTError, ExpiredSignatureError

        try:
            payload = jwt.decode(
                token,
                APP_CONFIG["jwt_secret"],
                algorithms=[APP_CONFIG["jwt_algorithm"]],
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
