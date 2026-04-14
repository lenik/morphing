from collections.abc import Generator

from sqlalchemy.orm import Session

from morphing.database import get_db


def db_session() -> Generator[Session, None, None]:
    yield from get_db()
