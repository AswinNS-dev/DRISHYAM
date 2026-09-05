from enum import Enum
from typing import Set
from app.security.roles import Role


class Permission(str, Enum):
    # System Administration
    MANAGE_USERS = "manage_users"
    MANAGE_SETTINGS = "manage_settings"
    VIEW_AUDIT_LOGS = "view_audit_logs"
    SYSTEM_TELEMETRY = "system_telemetry"

    # Investigation & Cases
    VIEW_CASES = "view_cases"
    MANAGE_CASES = "manage_cases"
    FILE_FIR = "file_fir"
    IMPORT_DATA = "import_data"
    
    # Evidence Management
    VIEW_EVIDENCE = "view_evidence"
    VERIFY_INTEGRITY = "verify_integrity"
    MANAGE_EVIDENCE = "manage_evidence"

    # Intelligence & Analysis
    VIEW_ENTITIES = "view_entities"
    VIEW_NETWORK = "view_network"
    RUN_ANALYSIS = "run_analysis"
    VIEW_ALERTS = "view_alerts"
    VIEW_TIMELINE = "view_timeline"
    VIEW_LOCATIONS = "view_locations"
    GENERATE_REPORTS = "generate_reports"


# Explicit Role -> Permissions mapping matrix
ROLE_PERMISSIONS: dict[Role, Set[Permission]] = {
    Role.ADMIN: {
        Permission.MANAGE_USERS,
        Permission.MANAGE_SETTINGS,
        Permission.VIEW_AUDIT_LOGS,
        Permission.SYSTEM_TELEMETRY,
        Permission.VIEW_CASES,
        Permission.MANAGE_CASES,
        Permission.FILE_FIR,
        Permission.IMPORT_DATA,
        Permission.VIEW_EVIDENCE,
        Permission.VERIFY_INTEGRITY,
        Permission.MANAGE_EVIDENCE,
        Permission.VIEW_ENTITIES,
        Permission.VIEW_NETWORK,
        Permission.RUN_ANALYSIS,
        Permission.VIEW_ALERTS,
        Permission.VIEW_TIMELINE,
        Permission.VIEW_LOCATIONS,
        Permission.GENERATE_REPORTS,
    },
    Role.INVESTIGATOR: {
        Permission.VIEW_CASES,
        Permission.MANAGE_CASES,
        Permission.FILE_FIR,
        Permission.IMPORT_DATA,
        Permission.VIEW_EVIDENCE,
        Permission.VERIFY_INTEGRITY,
        Permission.MANAGE_EVIDENCE,
        Permission.VIEW_ENTITIES,
        Permission.VIEW_NETWORK,
        Permission.RUN_ANALYSIS,
        Permission.VIEW_ALERTS,
        Permission.VIEW_TIMELINE,
        Permission.VIEW_LOCATIONS,
        Permission.GENERATE_REPORTS,
    },
    Role.ANALYST: {
        Permission.VIEW_CASES,
        Permission.VIEW_EVIDENCE,
        Permission.VERIFY_INTEGRITY,
        Permission.VIEW_ENTITIES,
        Permission.VIEW_NETWORK,
        Permission.RUN_ANALYSIS,
        Permission.VIEW_ALERTS,
        Permission.VIEW_TIMELINE,
        Permission.VIEW_LOCATIONS,
        Permission.GENERATE_REPORTS,
    },
}


def has_permission(role: Role, permission: Permission) -> bool:
    return permission in ROLE_PERMISSIONS.get(role, set())
