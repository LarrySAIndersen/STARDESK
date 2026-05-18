from fastapi import APIRouter, Depends

from star_itsm_api.core.security import require_staff
from star_itsm_api.models.user import User
from star_itsm_api.schemas.slack import SlackChannelRead
from star_itsm_api.services.slack_mock import MOCK_SLACK_CHANNELS

router = APIRouter(prefix="/slack", tags=["slack"])


@router.get("/channels", response_model=list[SlackChannelRead])
async def list_slack_channels(
    _current_user: User = Depends(require_staff()),
) -> list[SlackChannelRead]:
    return [SlackChannelRead.model_validate(channel) for channel in MOCK_SLACK_CHANNELS]
