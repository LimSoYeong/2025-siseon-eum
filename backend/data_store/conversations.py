import os
import json
import time
from typing import List, Dict


BASE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "conversations")


def _file_path(user_id: str, doc_id: str) -> str:
    user_dir = os.path.join(BASE_DIR, user_id)
    os.makedirs(user_dir, exist_ok=True)
    return os.path.join(user_dir, f"{doc_id}.json")


def append_message(user_id: str, doc_id: str, role: str, text: str, ts: float | None = None) -> None:
    path = _file_path(user_id, doc_id)
    record = {
        "role": role,
        "text": text,
        "ts": ts if ts is not None else time.time(),
    }
    data: Dict[str, List[Dict]] = {"messages": []}
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception:
            data = {"messages": []}
    data.setdefault("messages", []).append(record)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)


def get_conversation(user_id: str, doc_id: str) -> List[Dict]:
    path = _file_path(user_id, doc_id)
    if not os.path.exists(path):
        return []
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data.get("messages", [])
    except Exception:
        return []


