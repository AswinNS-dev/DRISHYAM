from typing import List, Optional
from fastapi import Depends, HTTPException, status
from app.core.security import get_current_user
from app.security.roles import Role, normalize_role
from app.security.permissions import Permission, has_permission


class AuthenticatedOfficer:
    def __init__(self, user_id: str, raw_role: str, email: Optional[str] = None, full_name: Optional[str] = None):
        self.user_id = user_id
        self.id = user_id
        self.email = email or f"officer-{user_id[:6]}"
        self.full_name = full_name or f"Officer #{user_id[:6]}"
        self.raw_role = raw_role
        self.role: Role = normalize_role(raw_role)

    def can(self, permission: Permission) -> bool:
        return has_permission(self.role, permission)


def get_current_officer(current_user: dict = Depends(get_current_user)) -> AuthenticatedOfficer:
    """Extract authenticated officer with normalized Role."""
    return AuthenticatedOfficer(
        user_id=current_user["user_id"],
        raw_role=current_user.get("role", "analyst"),
        email=current_user.get("email"),
        full_name=current_user.get("full_name"),
    )


def require_role(allowed_roles: List[Role]):
    """FastAPI dependency to enforce specific roles. Returns 403 Forbidden on mismatch."""
    def role_checker(officer: AuthenticatedOfficer = Depends(get_current_officer)):
        if officer.role not in allowed_roles and officer.role != Role.ADMIN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied: Role '{officer.role.value}' does not have permission for this tactical action."
            )
        return officer
    return role_checker


def require_permission(required_perm: Permission):
    """FastAPI dependency to enforce specific permission scope."""
    def perm_checker(officer: AuthenticatedOfficer = Depends(get_current_officer)):
        if not officer.can(required_perm):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied: Missing required clearance scope '{required_perm.value}'."
            )
        return officer
    return perm_checker
