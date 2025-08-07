import os
import pickle
import faiss
import torch
from typing import List
from PIL import Image

from langserve_app.model_loader import get_model, get_processor
from qwen_vl_utils import process_vision_info

model = get_model()
processor = get_processor()

VECTOR_DIR = "vector_store/image"
os.makedirs(VECTOR_DIR, exist_ok=True)

def save_image_embedding(client_id: str, image: Image.Image, metadata: str):
    """
    - 이미지 임베딩 벡터를 생성하여 사용자(client_id)별 FAISS 벡터 DB에 저장
    - metadata (요약 결과 등)를 함께 저장
    """
    messages = [{"role": "user", "content": [{"type": "image", "image": image}]}]

    with torch.no_grad():
        # Vision input 처리 (Qwen 기준)
        image_inputs, _ = process_vision_info(messages)

        # Dummy 텍스트 prompt (실제 추론 안 함)
        prompt = "이 이미지를 설명해줘"
        text = processor.apply_chat_template(
            [{"role": "user", "content": [{"type": "image", "image": image}, {"type": "text", "text": prompt}]}],
            tokenize=False,
            add_generation_prompt=True
        )

        # Processor에 넣기
        inputs = processor(
            text=[text],
            images=image_inputs["pixel_values"],
            return_tensors="pt"
        ).to(model.device)

        # 진짜 임베딩 추출 (마지막 hidden state의 첫 토큰 기준)
        outputs = model(**inputs, output_hidden_states=True)
        image_embedding = outputs.hidden_states[-1][:, 0, :].cpu().numpy()  # shape: (1, hidden_dim)

    # 저장 경로 설정
    index_path = os.path.join(VECTOR_DIR, f"{client_id}_index.faiss")
    meta_path = os.path.join(VECTOR_DIR, f"{client_id}_meta.pkl")

    # 기존 DB가 있으면 로딩
    if os.path.exists(index_path):
        index = faiss.read_index(index_path)
        try:
            with open(meta_path, "rb") as f:
                metadata_list = pickle.load(f)
        except Exception:
            metadata_list = []
    else:
        index = faiss.IndexFlatL2(image_embedding.shape[1])  # L2 거리 기반
        metadata_list = []

    # 벡터 추가
    index.add(image_embedding)
    metadata_list.append(metadata)

    # 저장
    faiss.write_index(index, index_path)
    with open(meta_path, "wb") as f:
        pickle.dump(metadata_list, f)


def search_similar_images(client_id: str, query_image: Image.Image, top_k: int = 3) -> List[str]:
    """
    - 쿼리 이미지와 유사한 top_k 이미지를 검색
    - metadata 리스트 반환
    """
    messages = [{"role": "user", "content": [{"type": "image", "image": query_image}]}]

    with torch.no_grad():
        image_inputs, _ = process_vision_info(messages)
        prompt = "이 이미지를 설명해줘"
        text = processor.apply_chat_template(
            [{"role": "user", "content": [{"type": "image", "image": query_image}, {"type": "text", "text": prompt}]}],
            tokenize=False,
            add_generation_prompt=True
        )
        inputs = processor(
            text=[text],
            images=image_inputs["pixel_values"],
            return_tensors="pt"
        ).to(model.device)

        outputs = model(**inputs, output_hidden_states=True)
        query_embedding = outputs.hidden_states[-1][:, 0, :].cpu().numpy()

    # 경로
    index_path = os.path.join(VECTOR_DIR, f"{client_id}_index.faiss")
    meta_path = os.path.join(VECTOR_DIR, f"{client_id}_meta.pkl")

    if not os.path.exists(index_path):
        return []

    index = faiss.read_index(index_path)
    with open(meta_path, "rb") as f:
        metadata_list = pickle.load(f)

    D, I = index.search(query_embedding, top_k)
    return [metadata_list[i] for i in I[0] if i < len(metadata_list)]
