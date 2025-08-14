from db_config import SessionLocal
from models import RecentDoc
from datetime import datetime, timezone

def _to_utc_datetime(ts: float | None) -> datetime:
    # 타임스탬프가 있으면 UTC aware로, 없으면 현재 UTC aware로
    return (
        datetime.fromtimestamp(ts, tz=timezone.utc)
        if ts is not None
        else datetime.now(timezone.utc)
    )

# 저장
def add_recent_doc(user_id, doc_id, path, title=None, doc_type=None, ts=None):
    db = SessionLocal()
    try:
        # 기존 항목 삭제 후 새로 저장 (세션 동기화 비용 절감)
        db.query(RecentDoc).filter_by(user_id=user_id, doc_id=doc_id).delete(synchronize_session=False)

        doc = RecentDoc(
            user_id=user_id,
            doc_id=doc_id,
            path=path,
            mtime=_to_utc_datetime(ts),
            title=title or "문서",
            doc_type=doc_type or "기타",
        )
        db.add(doc)
        db.commit()
    finally:
        db.close()

# 조회
def list_recent_docs(user_id: str, limit: int = 20):
    db = SessionLocal()
    try:
        records = (
            db.query(RecentDoc)
            .filter_by(user_id=user_id)
            .order_by(RecentDoc.mtime.desc())
            .limit(limit)
            .all()
        )

        result = []
        for r in records:
            dt = r.mtime or datetime.now(timezone.utc)
            # 과거 naive로 저장된 데이터 방어: UTC로 간주해 tz 부여
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            result.append({
                "doc_id": r.doc_id,
                "path": r.path,
                "mtime": dt.timestamp(),  # float(초)
                "title": r.title,
                "doc_type": r.doc_type,
            })
        return result
    finally:
        db.close()

# 삭제 (파일 삭제는 하지 않고 DB 레코드만 제거)
def delete_recent_doc(user_id: str, doc_id: str, path: str | None = None):
    db = SessionLocal()
    removed = False
    try:
        q = db.query(RecentDoc).filter_by(user_id=user_id, doc_id=doc_id)
        removed = q.delete(synchronize_session=False) > 0
        db.commit()
    finally:
        db.close()
    return {"removed": removed, "file_removed": False}

# 단건 조회 (세션 복원을 위해 사용)
def get_recent_doc(user_id: str, doc_id: str) -> dict | None:
    db = SessionLocal()
    try:
        r = (
            db.query(RecentDoc)
            .filter_by(user_id=user_id, doc_id=doc_id)
            .first()
        )
        if not r:
            return None
        dt = r.mtime or datetime.now(timezone.utc)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return {
            "doc_id": r.doc_id,
            "path": r.path,
            "mtime": dt.timestamp(),
            "title": r.title,
            "doc_type": r.doc_type,
        }
    finally:
        db.close()

# doc_id로만 조회 (쿠키가 사라졌을 때 복구용)
def get_recent_doc_by_doc_id(doc_id: str) -> dict | None:
    db = SessionLocal()
    try:
        r = (
            db.query(RecentDoc)
            .filter_by(doc_id=doc_id)
            .first()
        )
        if not r:
            return None
        dt = r.mtime or datetime.now(timezone.utc)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return {
            "user_id": r.user_id,
            "doc_id": r.doc_id,
            "path": r.path,
            "mtime": dt.timestamp(),
            "title": r.title,
            "doc_type": r.doc_type,
        }
    finally:
        db.close()

# 사용자의 가장 최근 문서 1건 조회
def get_latest_doc_for_user(user_id: str) -> dict | None:
    db = SessionLocal()
    try:
        r = (
            db.query(RecentDoc)
            .filter_by(user_id=user_id)
            .order_by(RecentDoc.mtime.desc())
            .first()
        )
        if not r:
            return None
        dt = r.mtime or datetime.now(timezone.utc)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return {
            "doc_id": r.doc_id,
            "path": r.path,
            "mtime": dt.timestamp(),
            "title": r.title,
            "doc_type": r.doc_type,
        }
    finally:
        db.close()
