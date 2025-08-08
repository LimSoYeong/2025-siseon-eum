import os
from functools import lru_cache
from typing import Dict

import numpy as np
import torch
from PIL import Image
from transformers import CLIPModel, CLIPProcessor

from faiss_db.db import SimpleFaissDB


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
    inputs = _get_clip_processor()(text=[text], return_tensors="pt", padding=True)
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


