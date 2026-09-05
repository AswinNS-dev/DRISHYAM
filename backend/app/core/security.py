import datetime as dt
from typing import Optional, List
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from passlib.context import CryptContext
from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v2/auth/login")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(subject: str, role: str) -> str:
    expire = dt.datetime.utcnow() + dt.timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    payload = {"sub": subject, "role": role, "exp": expire}
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has expired. Please authenticate to resume.",
            headers={"WWW-Authenticate": "Bearer"},
        )


def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    payload = decode_token(token)
    return {"user_id": payload["sub"], "role": payload["role"]}


def require_roles(allowed: List[str]):
    def checker(user: dict = Depends(get_current_user)):
        if user["role"] not in allowed and user["role"] != "admin":
            raise HTTPException(status_code=403, detail="Insufficient role permissions")
        return user
    return checker
