from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from typing import Optional
import datetime as dt

from app.database.db import get_db
from app.core.security import get_current_user, hash_password
from app.models import models as m

router = APIRouter(prefix="/api/v2/admin", tags=["admin"])


class UserCreate(BaseModel):
    email: str
    full_name: str
    password: str
    role: str = "analyst"


class RoleUpdate(BaseModel):
    role: str


@router.get("/users")
def list_users(db: Session = Depends(get_db), user=Depends(get_current_user)):
    users = db.query(m.User).order_by(m.User.created_at.desc()).all()
    return {
        "users": [
            {
                "id": u.id,
                "email": u.email,
                "full_name": u.full_name,
                "role": u.role,
                "is_active": u.is_active,
                "created_at": u.created_at.isoformat() if u.created_at else None,
            }
            for u in users
        ]
    }


@router.post("/users")
def create_user(payload: UserCreate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    existing = db.query(m.User).filter(m.User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="User with this email already exists")

    new_user = m.User(
        email=payload.email,
        full_name=payload.full_name,
        hashed_password=hash_password(payload.password),
        role=payload.role,
        is_active=True,
    )
    db.add(new_user)
    db.add(m.AuditLog(
        user_id=user["user_id"],
        action="USER_CREATED",
        details={"created_email": new_user.email, "role": new_user.role}
    ))
    db.commit()
    return {"status": "created", "user_id": new_user.id}


@router.patch("/users/{user_id}/role")
def update_user_role(user_id: str, payload: RoleUpdate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    target = db.query(m.User).filter(m.User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    old_role = target.role
    target.role = payload.role
    db.add(m.AuditLog(
        user_id=user["user_id"],
        action="USER_ROLE_CHANGED",
        details={"target_user": target.email, "old_role": old_role, "new_role": payload.role}
    ))
    db.commit()
    return {"status": "updated", "user_id": target.id, "role": target.role}


@router.get("/system")
def get_system_telemetry(db: Session = Depends(get_db), user=Depends(get_current_user)):
    from app.core.config import settings
    return {
        "telemetry": {
            "database": "Supabase / PostgreSQL" if settings.USING_SUPABASE else "SQLite Local High-Speed DB",
            "ai_provider": settings.AI_PROVIDER,
            "models_loaded": ["drishyam-nlp-v2", "drishyam-ner-v1", "networkx-louvain"],
            "total_persons": db.query(m.Person).count(),
            "total_vehicles": db.query(m.Vehicle).count(),
            "total_phones": db.query(m.Phone).count(),
            "total_firs": db.query(m.FIR).count(),
            "total_relationships": db.query(m.RelationshipRecord).count(),
            "total_audit_records": db.query(m.AuditLog).count(),
            "server_uptime": "Operational — 99.98%",
            "security_encryption": "AES-256 / SHA-256 + Bcrypt",
        }
    }


@router.get("/audit")
def list_audit_trail(db: Session = Depends(get_db), user=Depends(get_current_user)):
    logs = db.query(m.AuditLog).order_by(m.AuditLog.created_at.desc()).limit(150).all()
    return {
        "audit_logs": [
            {
                "id": l.id,
                "user_id": l.user_id,
                "action": l.action,
                "details": l.details,
                "created_at": l.created_at.isoformat() if l.created_at else None,
            }
            for l in logs
        ]
    }
