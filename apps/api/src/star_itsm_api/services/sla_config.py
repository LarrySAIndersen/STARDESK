"""Standard STAR resolution SLA targets (single source of truth for calculation)."""

from dataclasses import dataclass, replace
from typing import Literal

Priority = Literal["critical", "high", "medium", "low"]
SlaTimeKind = Literal["calendar_hours", "business_days"]
TicketType = Literal["incident", "service_request", "problem"]

TICKET_TYPES_FOR_SLA: tuple[TicketType, ...] = ("incident", "service_request", "problem")


@dataclass(frozen=True)
class SlaRule:
    priority: Priority
    label_da: str
    policy_name: str
    response_kind: SlaTimeKind
    response_amount: int
    resolution_kind: SlaTimeKind
    resolution_amount: int


# P1/P2: calendar hours (24/7). P3/P4: business days Mon–Fri (no Danish holidays in v1).
STANDARD_SLA_RULES: dict[Priority, SlaRule] = {
    "critical": SlaRule(
        priority="critical",
        label_da="Kritisk",
        policy_name="Critical (24/7)",
        response_kind="calendar_hours",
        response_amount=1,
        resolution_kind="calendar_hours",
        resolution_amount=4,
    ),
    "high": SlaRule(
        priority="high",
        label_da="Høj",
        policy_name="High",
        response_kind="calendar_hours",
        response_amount=2,
        resolution_kind="calendar_hours",
        resolution_amount=8,
    ),
    "medium": SlaRule(
        priority="medium",
        label_da="Mellem",
        policy_name="Medium",
        response_kind="business_days",
        response_amount=1,
        resolution_kind="business_days",
        resolution_amount=3,
    ),
    "low": SlaRule(
        priority="low",
        label_da="Lav",
        policy_name="Low",
        response_kind="business_days",
        response_amount=1,
        resolution_kind="business_days",
        resolution_amount=5,
    ),
}


# Longer resolution targets for service requests and problem records (response unchanged).
TICKET_TYPE_SLA_OVERRIDES: dict[TicketType, dict[Priority, dict[str, int]]] = {
    "service_request": {
        "medium": {"resolution_amount": 5},
        "low": {"resolution_amount": 7},
    },
    "problem": {
        "medium": {"resolution_amount": 10},
        "low": {"resolution_amount": 14},
    },
}


def get_sla_rule(priority: str, ticket_type: str | None = None) -> SlaRule:
    rule = STANDARD_SLA_RULES.get(priority)  # type: ignore[arg-type]
    if rule is None:
        rule = STANDARD_SLA_RULES["medium"]
    if not ticket_type or ticket_type == "incident":
        return rule
    if ticket_type not in TICKET_TYPE_SLA_OVERRIDES:
        return rule
    override = TICKET_TYPE_SLA_OVERRIDES[ticket_type].get(rule.priority)  # type: ignore[arg-type]
    if override is None:
        return rule
    return replace(rule, **override)
