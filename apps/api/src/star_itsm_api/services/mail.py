import logging

import httpx

from star_itsm_api.core.config import settings

logger = logging.getLogger(__name__)


async def send_escalation_email(*, to_address: str, subject: str, body: str) -> bool:
    if not settings.resend_api_key or not settings.mail_from:
        logger.warning("Resend not configured — skipping escalation email to %s", to_address)
        return False

    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {settings.resend_api_key}",
                "Content-Type": "application/json",
            },
            json={
                "from": settings.mail_from,
                "to": [to_address],
                "subject": subject,
                "text": body,
            },
        )
        if response.status_code >= 400:
            logger.error("Resend error %s: %s", response.status_code, response.text)
            return False
    return True
