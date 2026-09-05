from enum import Enum
from typing import List


class Role(str, Enum):
    ADMIN = "admin"
    INVESTIGATOR = "investigator"
    ANALYST = "analyst"


# Normalization helper for legacy roles like "crime_analyst" or "viewer"
def normalize_role(role_str: str) -> Role:
    if not role_str:
        return Role.ANALYST
    r = role_str.lower().strip()
    if r in ("admin", "administrator", "root"):
        return Role.ADMIN
    if r in ("investigator", "inspector", "detective"):
        return Role.INVESTIGATOR
    # Default analysts / crime_analysts / viewers
    return Role.ANALYST
