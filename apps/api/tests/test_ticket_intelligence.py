from datetime import UTC, datetime, timedelta
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from star_itsm_api.services.ticket_intelligence import (
    compute_heuristic_scores,
    extract_semantic_topics,
    intelligence_from_ticket,
    score_label_da,
    default_handling_hints,
    build_heuristic_summary,
    _hours_between,
    build_semantic_bundle,
    build_prompt_snippet,
    load_ticket_context_names,
    build_ticket_llm_context,
    build_llm_context_batch,
)


def _ticket(**overrides: object) -> MagicMock:
    ticket = MagicMock()
    ticket.title = "VPN virker ikke hjemmefra"
    ticket.description = "Bruger kan ikke oprette VPN forbindelse til STAR netværk."
    ticket.priority = "medium"
    ticket.ticket_type = "incident"
    ticket.is_major = False
    ticket.escalation_level = 0
    ticket.fault_displayed = False
    ticket.tags = ["vpn", "remote"]
    ticket.emoji = None
    ticket.semantic_topics = []
    ticket.ease_score = None
    ticket.complexity_score = None
    ticket.llm_summary = None
    ticket.handling_hints = []
    ticket.intelligence_source = None
    ticket.intelligence_updated_at = None
    ticket.resolution_due_at = None
    ticket.resolved_at = None
    for key, value in overrides.items():
        setattr(ticket, key, value)
    return ticket


def test_extract_semantic_topics_includes_tags_and_keywords() -> None:
    topics = extract_semantic_topics(
        title="Printer på 3. sal",
        description="Kan ikke printe to fælles printer",
        tags=["Printer"],
    )
    assert "printer" in topics


def test_compute_heuristic_scores_major_is_harder() -> None:
    normal = _ticket()
    major = _ticket(is_major=True, priority="critical")
    ease_n, complex_n = compute_heuristic_scores(normal)
    ease_m, complex_m = compute_heuristic_scores(major)
    assert ease_m < ease_n
    assert complex_m > complex_n


def test_intelligence_from_ticket_uses_stored_scores() -> None:
    ticket = _ticket(
        ease_score=5,
        complexity_score=1,
        semantic_topics=["demo"],
        llm_summary="Test",
        handling_hints=["Hint"],
        intelligence_source="seed",
        intelligence_updated_at=datetime.now(UTC),
    )
    read = intelligence_from_ticket(ticket)
    assert read.ease_score == 5
    assert read.source == "seed"
    assert read.llm_summary == "Test"


def test_intelligence_heuristic_when_not_stored() -> None:
    read = intelligence_from_ticket(_ticket())
    assert read.source == "heuristic"
    assert read.ease_score is not None
    assert 1 <= read.ease_score <= 5


def test_intelligence_clamps_invalid_stored_scores() -> None:
    read = intelligence_from_ticket(_ticket(ease_score=0, complexity_score=99))
    assert read.ease_score == 1
    assert read.complexity_score == 5


def test_score_label_da_none() -> None:
    assert score_label_da(None, ease=True) is None
    assert score_label_da(3, ease=True) == "Middel"
    assert score_label_da(1, ease=False) == "Meget lav"
    assert score_label_da(99, ease=False) == "99"


def test_extract_semantic_topics_many_words() -> None:
    # 15 distinct words of length >= 4
    words = "eksempel ordet teksten forbindelsen computeren skærmen tastaturet musen printeren ledningen routeren forbindelsesfejl systemet fejlbeskeden opsætningen"
    topics = extract_semantic_topics(
        title="Overskrift",
        description=f"Beskrivelse med mange ord: {words}",
        tags=["tag1", "tag2", "tag1", "   "],
    )
    assert len(topics) == 12


def test_compute_heuristic_scores_variations() -> None:
    # low priority and service_request, short description
    low_req = _ticket(priority="low", ticket_type="service_request", description="Short desc")
    ease, complexity = compute_heuristic_scores(low_req)
    assert ease >= 3
    assert complexity <= 3

    # problem and escalation and long description
    prob = _ticket(
        priority="high",
        ticket_type="problem",
        escalation_level=1,
        description="A" * 700,
        title="sikkerhed",  # hard topic
    )
    ease, complexity = compute_heuristic_scores(prob)
    assert ease <= 3
    assert complexity >= 3

    # medium description
    med_desc = _ticket(description="A" * 200)
    ease, complexity = compute_heuristic_scores(med_desc)
    assert 1 <= ease <= 5


def test_default_handling_hints() -> None:
    ticket = _ticket(is_major=False, fault_displayed=False)
    hints = default_handling_hints(ticket, ease=3, complexity=3)
    assert "Standard triage" in hints[0]

    ticket_major = _ticket(is_major=True, fault_displayed=True)
    hints_major = default_handling_hints(ticket_major, ease=1, complexity=5)
    assert any("Stor sag" in h for h in hints_major)
    assert any("Fejl er allerede" in h for h in hints_major)


def test_hours_between_and_bundle() -> None:
    t1 = datetime(2026, 6, 5, 12, 0, 0, tzinfo=UTC)
    t2 = datetime(2026, 6, 5, 15, 30, 0, tzinfo=UTC)
    assert _hours_between(t1, t2) == 3.5

    ticket = _ticket(tags=["tag1"], emoji="💡")
    bundle = build_semantic_bundle(
        ticket=ticket,
        category_name="Netværk",
        subcategory_name="VPN",
        sub_cause_names=["Fejl", "Afbrudt"],
    )
    assert "tag1" in bundle.combined_text
    assert "Netværk" in bundle.combined_text
    assert "💡" in bundle.combined_text


def test_build_prompt_snippet() -> None:
    from star_itsm_api.schemas.ticket_intelligence import TicketLlmOperationalRead

    ticket = _ticket()
    intel = intelligence_from_ticket(ticket)
    oper = TicketLlmOperationalRead(
        status="new",
        priority="medium",
        ticket_type="incident",
        is_major=False,
        escalation_level=0,
        fault_displayed=False,
        assigned_team_name="Support",
        assigned_user_name="John",
        organization_name="STAR",
        age_hours=2.5,
        open_hours=2.5,
    )
    snippet = build_prompt_snippet(ticket, intel, oper)
    assert ticket.title in snippet


@pytest.mark.asyncio
async def test_load_ticket_context_names() -> None:
    db = AsyncMock()

    mock_cat = MagicMock()
    mock_cat.name_da = "KatDA"
    mock_sub = MagicMock()
    mock_sub.name_da = "SubKatDA"
    mock_team = MagicMock()
    mock_team.name = "TeamName"
    mock_user = MagicMock()
    mock_user.display_name = "UserDisplayName"
    mock_org = MagicMock()
    mock_org.name = "OrgName"

    db.get = AsyncMock(side_effect=[mock_cat, mock_sub, mock_team, mock_user, mock_org])

    mock_subcause = MagicMock()
    mock_subcause.name_da = "SubCauseDA"
    mock_execute_result = MagicMock()
    mock_execute_result.scalars.return_value.all.return_value = [mock_subcause]
    db.execute = AsyncMock(return_value=mock_execute_result)

    ticket = _ticket(
        category_id=uuid.uuid4(),
        subcategory_id=uuid.uuid4(),
        assigned_team_id=uuid.uuid4(),
        assigned_user_id=uuid.uuid4(),
        organization_id=uuid.uuid4(),
    )

    res = await load_ticket_context_names(db, ticket)
    assert res == ("KatDA", "SubKatDA", ["SubCauseDA"], "TeamName", "UserDisplayName", "OrgName")


@pytest.mark.asyncio
async def test_build_ticket_llm_context_variations() -> None:
    db = AsyncMock()
    db.get = AsyncMock(return_value=None)

    mock_sc = MagicMock()
    mock_sc.name_da = "SubCause"
    mock_res1 = MagicMock()
    mock_res1.scalars.return_value.all.return_value = [mock_sc]

    mock_team = MagicMock()
    mock_team.id = uuid.uuid4()
    mock_team.name = "Support"
    mock_res2 = MagicMock()
    mock_res2.scalars.return_value.all.return_value = [mock_team]

    mock_res3 = MagicMock()
    mock_res3.scalar_one.return_value = 1

    db.execute = AsyncMock(side_effect=[mock_res1, mock_res2, mock_res3])

    # Case A: status resolved with naive resolved_at and naive created_at
    ticket = _ticket(
        id=uuid.uuid4(),
        ticket_number="REQ-101",
        created_at=datetime.now(),  # naive
        status="resolved",
        resolved_at=datetime.now(),  # naive
        category_id=None,
        subcategory_id=None,
        assigned_team_id=None,
        assigned_user_id=None,
        organization_id=None,
    )

    context = await build_ticket_llm_context(db, ticket)
    assert context.ticket_number == "REQ-101"
    assert context.operational.open_hours is not None

    # Case B: status closed with resolved_at is None
    db.execute = AsyncMock(side_effect=[mock_res1, mock_res2, mock_res3])
    ticket_no_resolved_at = _ticket(
        id=uuid.uuid4(),
        ticket_number="REQ-101B",
        created_at=datetime.now(UTC),
        status="closed",
        resolved_at=None,
        category_id=None,
        subcategory_id=None,
        assigned_team_id=None,
        assigned_user_id=None,
        organization_id=None,
    )
    context_b = await build_ticket_llm_context(db, ticket_no_resolved_at)
    assert context_b.operational.open_hours is None

    # Case C: status new (open_hours = age_hours)
    db.execute = AsyncMock(side_effect=[mock_res1, mock_res2, mock_res3])
    ticket_new = _ticket(
        id=uuid.uuid4(),
        ticket_number="REQ-101C",
        created_at=datetime.now(),  # naive (covers naive created_at branch in age_hours)
        status="new",
        category_id=None,
        subcategory_id=None,
        assigned_team_id=None,
        assigned_user_id=None,
        organization_id=None,
    )
    context_c = await build_ticket_llm_context(db, ticket_new)
    assert context_c.operational.open_hours is not None

    # Case D: status resolved with aware resolved_at (covers 359->361 branch false)
    db.execute = AsyncMock(side_effect=[mock_res1, mock_res2, mock_res3])
    ticket_aware_resolved = _ticket(
        id=uuid.uuid4(),
        ticket_number="REQ-101D",
        created_at=datetime.now(UTC),
        status="resolved",
        resolved_at=datetime.now(UTC),  # aware
        category_id=None,
        subcategory_id=None,
        assigned_team_id=None,
        assigned_user_id=None,
        organization_id=None,
    )
    context_d = await build_ticket_llm_context(db, ticket_aware_resolved)
    assert context_d.operational.open_hours is not None


@pytest.mark.asyncio
async def test_build_llm_context_batch() -> None:
    db = AsyncMock()
    db.get = AsyncMock(return_value=None)

    mock_res1 = MagicMock()
    mock_res1.scalars.return_value.all.return_value = []
    mock_res2 = MagicMock()
    mock_res2.scalars.return_value.all.return_value = []
    mock_res3 = MagicMock()
    mock_res3.scalar_one.return_value = 0

    db.execute = AsyncMock(side_effect=[mock_res1, mock_res2, mock_res3])

    ticket = _ticket(
        id=uuid.uuid4(),
        ticket_number="REQ-102",
        created_at=datetime.now(UTC),
        status="new",
        category_id=None,
        subcategory_id=None,
        assigned_team_id=None,
        assigned_user_id=None,
        organization_id=None,
    )

    batch = await build_llm_context_batch(db, [ticket])
    assert len(batch) == 1
    assert batch[0].ticket_number == "REQ-102"
