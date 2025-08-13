import os
import json
import time
from typing import List, Dict, Optional


BASE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "recent_docs")


def _file_path(user_id: str) -> str:
    os.makedirs(BASE_DIR, exist_ok=True)
    return os.path.join(BASE_DIR, f"{user_id}.json")


def add_recent_doc(
    user_id: str,
    doc_id: str,
    path: str,
    title: Optional[str] = None,
    doc_type: Optional[str] = None,
    ts: Optional[float] = None,
) -> None:
    """사용자의 최근 문서 목록에 항목을 추가하거나 갱신합니다."""
    fp = _file_path(user_id)
    records: List[Dict] = []
    if os.path.exists(fp):
        try:
            with open(fp, "r", encoding="utf-8") as f:
                records = json.load(f)
        except Exception:
            records = []

    # 파일 수정 시각 기준 mtime 산출
    try:
        mtime = os.path.getmtime(path) if path and os.path.exists(path) else 0
    except Exception:
        mtime = 0
    if not mtime:
        mtime = ts or time.time()

    item = {
        "doc_id": doc_id,
        "path": path,
        "mtime": mtime,
        "title": (title or "문서").strip() or "문서",
        "doc_type": doc_type or "기타",
    }

    # 기존 동일 doc_id 항목 제거 후 갱신
    records = [r for r in records if r.get("doc_id") != doc_id]
    records.append(item)
    # 최신순 정렬 및 상한 100개 유지
    records.sort(key=lambda x: x.get("mtime", 0), reverse=True)
    if len(records) > 100:
        records = records[:100]

    with open(fp, "w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False)


def list_recent_docs(user_id: str, limit: int = 20) -> List[Dict]:
    fp = _file_path(user_id)
    if not os.path.exists(fp):
        return []
    try:
        with open(fp, "r", encoding="utf-8") as f:
            records = json.load(f)
            # 최신순 보장, limit 적용
            records.sort(key=lambda x: x.get("mtime", 0), reverse=True)
            return records[:limit]
    except Exception:
        return []


def delete_recent_doc(user_id: str, doc_id: Optional[str] = None, *, path: Optional[str] = None, remove_file: bool = True) -> Dict:
    """최근 문서에서 항목을 삭제하고(선택적으로) 원본 파일도 제거합니다.
    - 기본은 doc_id 기준으로 삭제
    - doc_id가 없거나 못 찾으면 path 기준으로도 시도
    반환: {"removed": True/False, "path": 삭제된 파일 경로(있다면)}
    """
    fp = _file_path(user_id)
    if not os.path.exists(fp):
        return {"removed": False}
    try:
        with open(fp, "r", encoding="utf-8") as f:
            records = json.load(f)
    except Exception:
        records = []
    path = None
    kept = []
    removed = False
    for r in records:
        if doc_id and r.get("doc_id") == doc_id:
            removed = True
            path = r.get("path")
            continue
        kept.append(r)
    # doc_id로 못 지웠고, path가 주어진 경우 path 기준 재시도
    if not removed and path:
        kept2 = []
        for r in kept:
            if r.get("path") == path:
                removed = True
                path = r.get("path")
                continue
            kept2.append(r)
        kept = kept2
    with open(fp, "w", encoding="utf-8") as f:
        json.dump(kept, f, ensure_ascii=False)
    if remove_file and path and os.path.exists(path):
        try:
            os.remove(path)
        except Exception:
            pass
    return {"removed": removed, "path": path}

