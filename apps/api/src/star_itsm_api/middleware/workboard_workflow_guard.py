"""Work Board workflow guard (service-layer middleware).

Status changes in Neon are applied only when they match the agent kanban pipeline
(+1 forward or Human Review → In Progress). Invoked from workboard_service on
bulk-import, PATCH, and PUT — not from deploy scripts pushing stale canvas cache.

See workboard_status_guard.resolve_persisted_status.
"""

from star_itsm_api.services.workboard_status_guard import (
    is_allowed_workflow_status_change,
    resolve_persisted_status,
)

__all__ = [
    "is_allowed_workflow_status_change",
    "resolve_persisted_status",
]
