from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.database.db import get_db
from app.models import models as m
from app.core.security import verify_password, create_access_token

router = APIRouter(prefix="/api/v2/auth", tags=["auth"])


@router.post("/login")
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(m.User).filter(m.User.email == form.username).first()
    if not user or not verify_password(form.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    token = create_access_token(user.id, user.role)
    db.add(m.AuditLog(user_id=user.id, action="LOGIN", details={"email": user.email}))
    db.commit()
    return {
        "access_token": token, "token_type": "bearer",
        "user": {"id": user.id, "email": user.email, "full_name": user.full_name, "role": user.role},
    }


@router.get("/demo-accounts")
def demo_accounts():
    return {
        "accounts": [
            {"email": "investigator@drishyam.demo", "password": "demo1234", "role": "investigator"},
            {"email": "admin@drishyam.demo", "password": "demo1234", "role": "admin"},
            {"email": "analyst@drishyam.demo", "password": "demo1234", "role": "crime_analyst"},
        ]
    }
