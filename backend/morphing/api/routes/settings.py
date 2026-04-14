import httpx
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from morphing.api.deps import db_session
from morphing.schemas.extra import AppSettingsHealthCheckResponse, AppSettingsPayload
from morphing.services import settings_registry_service

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("/app", response_model=AppSettingsPayload)
def get_app_settings(db: Session = Depends(db_session)) -> AppSettingsPayload:
    payload = settings_registry_service.get_app_settings(db)
    return AppSettingsPayload(**payload)


@router.put("/app", response_model=AppSettingsPayload)
def put_app_settings(payload: AppSettingsPayload, db: Session = Depends(db_session)) -> AppSettingsPayload:
    saved = settings_registry_service.save_app_settings(db, payload.model_dump())
    return AppSettingsPayload(**saved)


@router.post("/app/health-check", response_model=AppSettingsHealthCheckResponse)
def app_settings_health_check(
    payload: AppSettingsPayload,
    db: Session = Depends(db_session),
) -> AppSettingsHealthCheckResponse:
    _ = db
    base_url = payload.openaiApiBaseUrl.strip().rstrip("/")
    api_key = payload.openaiApiKey.strip()
    model = payload.openaiDefaultModel.strip() or "gpt-4o-mini"
    timeout_sec = max(5, int(payload.requestTimeoutSec or 120))

    if not base_url:
        return AppSettingsHealthCheckResponse(ok=False, model=model, message="OpenAI API base URL is empty.")
    if not api_key:
        return AppSettingsHealthCheckResponse(ok=False, model=model, message="OpenAI API key is empty.")

    try:
        with httpx.Client(timeout=float(timeout_sec)) as client:
            res = client.post(
                f"{base_url}/chat/completions",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={
                    "model": model,
                    "messages": [{"role": "user", "content": "Reply exactly: ok"}],
                    "max_tokens": 8,
                },
            )
            if not res.is_success:
                text = (res.text or "").strip()
                if len(text) > 240:
                    text = text[:240] + "…"
                return AppSettingsHealthCheckResponse(
                    ok=False,
                    provider_status=res.status_code,
                    model=model,
                    message=text or f"Provider returned HTTP {res.status_code}.",
                )
            data = res.json()
            content = (
                str(data.get("choices", [{}])[0].get("message", {}).get("content", "")).strip()
                if isinstance(data, dict)
                else ""
            )
            return AppSettingsHealthCheckResponse(
                ok=True,
                provider_status=res.status_code,
                model=model,
                message=content or "Connected successfully.",
            )
    except Exception as e:
        return AppSettingsHealthCheckResponse(
            ok=False,
            model=model,
            message=f"{type(e).__name__}: {str(e)[:240]}",
        )
