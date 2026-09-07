import datetime as dt
from typing import Optional, Any, Dict
from sqlalchemy.orm import Session
from app.models import models as m


def log_audit_event(
    db: Session,
    action: str,
    user_id: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
) -> m.AuditLog:
    """
    Records a real, immutable security and investigation event in the audit log.
    Captures user ID, action type, structured details, and UTC timestamp.
    """
    entry = m.AuditLog(
        user_id=user_id,
        action=action,
        details=details or {},
        created_at=dt.datetime.utcnow(),
    )
    db.add(entry)
    return entry
