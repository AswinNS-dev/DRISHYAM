from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, Dict, Any

from app.database.db import get_db
from app.core.config import settings
from app.security.roles import Role
from app.security.dependencies import AuthenticatedOfficer, require_role, get_current_officer

router = APIRouter(prefix="/api/v2/settings", tags=["settings"])


class SettingsUpdate(BaseModel):
    ai_provider: Optional[str] = None
    min_confidence_threshold: Optional[float] = None
    fuzzy_match_threshold: Optional[float] = None
    anonymize_pii_in_exports: Optional[bool] = None
    dark_mode_accent: Optional[str] = None


# In-memory settings override for session
SYSTEM_CONFIG = {
    "ai_provider": settings.AI_PROVIDER,
    "available_providers": ["GEMINI", "GROQ", "OPENAI", "OLLAMA_LOCAL", "HEURISTIC_EXPLAINABLE"],
    "min_confidence_threshold": 0.70,
    "fuzzy_match_threshold": 0.82,
    "anonymize_pii_in_exports": False,
    "dark_mode_accent": "teal",
    "retention_days": 365,
    "system_version": "DRISHYAM v2.4-CYBER",
}


@router.get("")
def get_system_settings(officer: AuthenticatedOfficer = Depends(get_current_officer)):
    return {"settings": SYSTEM_CONFIG}


@router.post("")
def update_system_settings(
    payload: SettingsUpdate,
    officer: AuthenticatedOfficer = Depends(require_role([Role.ADMIN]))
):
    if payload.ai_provider:
        SYSTEM_CONFIG["ai_provider"] = payload.ai_provider
    if payload.min_confidence_threshold is not None:
        SYSTEM_CONFIG["min_confidence_threshold"] = payload.min_confidence_threshold
    if payload.fuzzy_match_threshold is not None:
        SYSTEM_CONFIG["fuzzy_match_threshold"] = payload.fuzzy_match_threshold
    if payload.anonymize_pii_in_exports is not None:
        SYSTEM_CONFIG["anonymize_pii_in_exports"] = payload.anonymize_pii_in_exports
    if payload.dark_mode_accent:
        SYSTEM_CONFIG["dark_mode_accent"] = payload.dark_mode_accent

    return {"status": "saved", "settings": SYSTEM_CONFIG}
