from __future__ import annotations

import json
from threading import Lock
from typing import Any

from sqlalchemy.orm import Session

from morphing.models import AppSetting

APP_SETTINGS_KEY = "app_settings.v1"

DEFAULT_APP_SETTINGS: dict[str, Any] = {
    "apiBaseUrl": "",
    "openaiApiBaseUrl": "https://api.openai.com/v1",
    "openaiApiKey": "",
    "openaiOrganizationId": "",
    "openaiDefaultModel": "gpt-4o-mini",
    "aiCompletionAcceptConfidence": 0.6,
    "showCompleteRequestMessageToLlm": False,
    "requestTimeoutSec": 120,
    "useBrowserNotifications": True,
    "defaultAuthorName": "",
    "locale": "en",
    "elementListLimit": 500,
}

_cache_lock = Lock()
_cache: dict[str, dict[str, Any]] = {}


def _normalize(payload: dict[str, Any]) -> dict[str, Any]:
    next_val = {**DEFAULT_APP_SETTINGS}
    for k in DEFAULT_APP_SETTINGS:
        if k in payload:
            next_val[k] = payload[k]
    next_val["apiBaseUrl"] = str(next_val.get("apiBaseUrl", "")).strip()
    next_val["openaiApiBaseUrl"] = str(next_val.get("openaiApiBaseUrl", "")).strip()
    next_val["openaiApiKey"] = str(next_val.get("openaiApiKey", "")).strip()
    next_val["openaiOrganizationId"] = str(next_val.get("openaiOrganizationId", "")).strip()
    next_val["openaiDefaultModel"] = str(next_val.get("openaiDefaultModel", "")).strip() or "gpt-4o-mini"
    try:
        conf = float(next_val.get("aiCompletionAcceptConfidence", 0.6))
    except Exception:
        conf = 0.6
    next_val["aiCompletionAcceptConfidence"] = max(0.5, min(1.0, conf))
    next_val["showCompleteRequestMessageToLlm"] = bool(next_val.get("showCompleteRequestMessageToLlm", False))
    try:
        timeout = int(next_val.get("requestTimeoutSec", 120))
    except Exception:
        timeout = 120
    next_val["requestTimeoutSec"] = max(5, timeout)
    next_val["useBrowserNotifications"] = bool(next_val.get("useBrowserNotifications", True))
    next_val["defaultAuthorName"] = str(next_val.get("defaultAuthorName", "")).strip()
    next_val["locale"] = str(next_val.get("locale", "en")).strip() or "en"
    try:
        list_limit = int(next_val.get("elementListLimit", 500))
    except Exception:
        list_limit = 500
    next_val["elementListLimit"] = max(1, min(500, list_limit))
    return next_val


def get_app_settings(db: Session) -> dict[str, Any]:
    with _cache_lock:
        if APP_SETTINGS_KEY in _cache:
            return dict(_cache[APP_SETTINGS_KEY])

    row = db.get(AppSetting, APP_SETTINGS_KEY)
    if not row:
        val = dict(DEFAULT_APP_SETTINGS)
        with _cache_lock:
            _cache[APP_SETTINGS_KEY] = val
        return val
    try:
        parsed = json.loads(row.value_json)
    except Exception:
        parsed = {}
    val = _normalize(parsed if isinstance(parsed, dict) else {})
    with _cache_lock:
        _cache[APP_SETTINGS_KEY] = val
    return dict(val)


def save_app_settings(db: Session, payload: dict[str, Any]) -> dict[str, Any]:
    val = _normalize(payload)
    row = db.get(AppSetting, APP_SETTINGS_KEY)
    if row:
        row.value_json = json.dumps(val, ensure_ascii=False)
    else:
        row = AppSetting(key=APP_SETTINGS_KEY, value_json=json.dumps(val, ensure_ascii=False))
        db.add(row)
    db.commit()
    with _cache_lock:
        _cache[APP_SETTINGS_KEY] = val
    return dict(val)
