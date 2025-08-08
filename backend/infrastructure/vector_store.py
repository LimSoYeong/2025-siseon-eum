import os
from functools import lru_cache
from typing import Dict

import numpy as np
import torch
from PIL import Image
from transformers import CLIPModel, CLIPProcessor

from faiss_db.db import SimpleFaissDB
from typing import List, Optional


@lru_cache()
def _get_device() -> str:
    return "cuda:0" if torch.cuda.is_available() else "cpu"


@lru_cache()
def _get_clip_model() -> CLIPModel:
    model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
    return model.to(_get_device()).eval()


@lru_cache()
def _get_clip_processor() -> CLIPProcessor:
    return CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")


@lru_cache()
def _get_faiss_db() -> SimpleFaissDB:
    # CLIP projection dimension은 512
    dim = int(_get_clip_model().config.projection_dim)
    db = SimpleFaissDB(dim)
    # 인덱스가 있으면 로드
    try:
        if os.path.exists("faiss_db/index.faiss") and os.path.exists("faiss_db/index.pkl"):
            db.load()
    except Exception:
        # 손상 시 새로 생성
        pass
    return db


def _l2_normalize(x: np.ndarray) -> np.ndarray:
    denom = np.linalg.norm(x) + 1e-12
    return x / denom


def encode_text_to_vec(text: str) -> np.ndarray:
    # CLIP 텍스트 최대 길이는 77 토큰. 초과 시 잘라 오류 방지
    inputs = _get_clip_processor()(
        text=[text],
        return_tensors="pt",
        padding=True,
        truncation=True,
        max_length=77,
    )
    inputs = {k: v.to(_get_device()) for k, v in inputs.items()}
    with torch.no_grad():
        outputs = _get_clip_model().get_text_features(**inputs)
    vec = outputs[0].detach().cpu().numpy().astype(np.float32)
    return _l2_normalize(vec)


def encode_image_to_vec(image: Image.Image) -> np.ndarray:
    inputs = _get_clip_processor()(images=image, return_tensors="pt")
    inputs = {k: v.to(_get_device()) for k, v in inputs.items()}
    with torch.no_grad():
        outputs = _get_clip_model().get_image_features(**inputs)
    vec = outputs[0].detach().cpu().numpy().astype(np.float32)
    return _l2_normalize(vec)


def save_image_embedding(image_path: str, user_id: str, extra_metadata: Dict = None) -> None:
    image = Image.open(image_path).convert("RGB")
    embedding = encode_image_to_vec(image)
    metadata = {"type": "image", "path": image_path, "user_id": user_id}
    if extra_metadata:
        metadata.update(extra_metadata)
    # 이미지 항목의 본문 텍스트는 비워둠
    _get_faiss_db().add(embedding, text="", metadata=metadata)
    _get_faiss_db().save()


def save_text_embedding(text: str, user_id: str, extra_metadata: Dict = None) -> None:
    embedding = encode_text_to_vec(text)
    metadata = {"type": "text", "user_id": user_id}
    if extra_metadata:
        metadata.update(extra_metadata)
    _get_faiss_db().add(embedding, text=text, metadata=metadata)
    _get_faiss_db().save()


def search_by_text(query: str, k: int = 5):
    q = encode_text_to_vec(query)
    return _get_faiss_db().search(q, k=k)


def search_by_image(image_path: str, k: int = 5):
    image = Image.open(image_path).convert("RGB")
    q = encode_image_to_vec(image)
    return _get_faiss_db().search(q, k=k)


def list_recent_docs(user_id: str, limit: int = 10) -> List[dict]:
    """FAISS 메타데이터에서 해당 사용자의 이미지 항목을 찾아 최근순으로 반환.
    간단한 페어링: 이미지 다음에 등장하는 summary/summary_snippet 텍스트를 제목으로 사용.
    """
    db = _get_faiss_db()
    items = []
    # 인덱스 순회하며 이미지 항목 수집
    for i, meta in enumerate(db.metadatas):
        if not isinstance(meta, dict):
            continue
        if meta.get("type") == "image" and meta.get("user_id") == user_id:
            path = meta.get("path")
            # 생성시간 추정: 파일 mtime이 없으면 메타에 timestamp 없으므로 현재시간으로 대체
            try:
                mtime = os.path.getmtime(path) if path and os.path.exists(path) else 0
            except Exception:
                mtime = 0
            # 제목 후보: 인접 텍스트 항목 + doc_id 주입
            title: Optional[str] = None
            doc_id = meta.get("doc_id")
            for j in range(i + 1, min(i + 6, len(db.texts))):
                meta_j = db.metadatas[j]
                if isinstance(meta_j, dict) and meta_j.get("user_id") == user_id and meta_j.get("type") == "text":
                    src = meta_j.get("source")
                    if src in {"summary_snippet", "summary"}:
                        title = db.texts[j]
                        break
            items.append({"path": path, "mtime": mtime, "title": title or "문서", "doc_id": doc_id})

    # 중복 제거: doc_id 우선, 없으면 path 기준
    seen = set()
    unique_items = []
    for it in sorted(items, key=lambda x: x.get("mtime", 0), reverse=True):
        key = it.get("doc_id") or it.get("path")
        if key and key in seen:
            continue
        if key:
            seen.add(key)
        unique_items.append(it)
    return unique_items[:limit]


