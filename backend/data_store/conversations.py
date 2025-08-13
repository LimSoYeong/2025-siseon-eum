from db_config import SessionLocal
from models import Conversation
from datetime import datetime, timezone
from sqlalchemy import Column, DateTime
from datetime import datetime, timezone

mtime = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

def _to_utc_datetime(ts: float | None) -> datetime:
    # ts(유닉스 타임스탬프)가 있으면 UTC aware로 변환, 없으면 지금 UTC
    return (
        datetime.fromtimestamp(ts, tz=timezone.utc)
        if ts is not None
        else datetime.now(timezone.utc)
    )

# 저장
def append_message(user_id: str, doc_id: str, role: str, text: str, ts: float | None = None):
    db = SessionLocal()
    try:
        message = Conversation(
            user_id=user_id,
            doc_id=doc_id,
            role=role,
            text=text,
            ts=_to_utc_datetime(ts),
        )
        db.add(message)
        db.commit()
    finally:
        db.close()

# 조회
def get_conversation(user_id: str, doc_id: str):
    db = SessionLocal()
    try:
        records = (
            db.query(Conversation)
            .filter_by(user_id=user_id, doc_id=doc_id)
            .order_by(Conversation.ts)
            .all()
        )

        result = []
        for r in records:
            # 과거 데이터가 naive일 수 있으니 UTC로 간주해 tzinfo 보정
            dt = r.ts if r.ts is not None else datetime.now(timezone.utc)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            result.append({"role": r.role, "text": r.text, "ts": dt.timestamp()})
        return result
    finally:
        db.close()
