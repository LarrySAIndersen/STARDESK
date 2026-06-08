from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from star_itsm_api.models.personal import PersonalNote

IDE_NOTE_PREFIX = "IDE"


async def generate_personal_note_number(db: AsyncSession) -> str:
    year = datetime.now(UTC).year
    pattern = f"{IDE_NOTE_PREFIX}-{year}-%"
    result = await db.execute(
        select(PersonalNote.note_number)
        .where(PersonalNote.note_number.like(pattern))
        .order_by(PersonalNote.note_number.desc())
        .limit(1)
    )
    max_number = result.scalar_one_or_none()
    if max_number:
        try:
            sequence = int(max_number.split("-")[-1]) + 1
        except (ValueError, IndexError):
            sequence = 1
    else:
        sequence = 1
    return f"{IDE_NOTE_PREFIX}-{year}-{sequence:05d}"
