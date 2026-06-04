"""Audit middleware: record mutating requests to `activity_log`.

Best-effort and non-blocking for the caller — any logging error is swallowed so
it can never break the actual request.
"""

from __future__ import annotations

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

_AUDITED_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


class ActivityLogMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        if request.method in _AUDITED_METHODS:
            self._record(request, response.status_code)
        return response

    @staticmethod
    def _record(request: Request, status_code: int) -> None:
        try:
            user_id = None
            auth = request.headers.get("authorization", "")
            if auth.lower().startswith("bearer "):
                from app.security import decode_token
                try:
                    user_id = int(decode_token(auth[7:]).get("sub"))
                except Exception:
                    user_id = None

            from app.db import SessionLocal
            from orm import ActivityLog

            client_host = request.client.host if request.client else None
            with SessionLocal() as db:
                db.add(ActivityLog(
                    user_id=user_id,
                    action=f"{request.method} {request.url.path}",
                    metadata_={"status": status_code, "ip": client_host},
                ))
                db.commit()
        except Exception:
            # Never let auditing break the request lifecycle.
            pass
