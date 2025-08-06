import os
import pickle
import faiss
import torch
from typing import List
from langserve_app.model_loader import get_model, get_processor
from qwen_vl_utils import process_vision_info
from PIL import Image

model = get_model()
processor = get_processor()

VECTOR_DIR = "vector_store/image"
os.makedirs(VECTOR_DIR, exist_ok=True)

def save_image_embedding(client_id: str, image: Image.Image, metadata: str):
    messages = [{"role": "user", "content": [{"type": "image", "image": image}]}]
    with torch.no_grad():
        image_inputs, _ = process_vision_info(messages)

    image_vector = image_inputs["pixel_values"].reshape(1, -1).cpu().numpy()

    index_path = os.path.join(VECTOR_DIR, f"{client_id}_index.faiss")
    meta_path = os.path.join(VECTOR_DIR, f"{client_id}_meta.pkl")

    if os.path.exists(index_path):
        index = faiss.read_index(index_path)
        with open(meta_path, "rb") as f:
            try:
                metadata_list = pickle.load(f)
            except Exception:
                metadata_list = []
    else:
        index = faiss.IndexFlatL2(image_vector.shape[1])
        metadata_list = []

    index.add(image_vector)
    metadata_list.append(metadata)

    faiss.write_index(index, index_path)
    with open(meta_path, "wb") as f:
        pickle.dump(metadata_list, f)

def search_similar_images(client_id: str, query_image: Image.Image, top_k: int = 3) -> List[str]:
    messages = [{"role": "user", "content": [{"type": "image", "image": query_image}]}]
    with torch.no_grad():
        query_inputs, _ = process_vision_info(messages)
    query_vector = query_inputs["pixel_values"].reshape(1, -1).cpu().numpy()

    index_path = os.path.join(VECTOR_DIR, f"{client_id}_index.faiss")
    meta_path = os.path.join(VECTOR_DIR, f"{client_id}_meta.pkl")

    if not os.path.exists(index_path):
        return []

    index = faiss.read_index(index_path)
    with open(meta_path, "rb") as f:
        metadata_list = pickle.load(f)

    D, I = index.search(query_vector, top_k)
    return [metadata_list[i] for i in I[0] if i < len(metadata_list)]

# --- 텍스트 요약 / QA 저장용 (LangChain/RAG 용) ---

def _embed_text(text: str):
    inputs = processor(text=[text], return_tensors="pt").to(model.device)
    with torch.no_grad():
        outputs = model.forward(**inputs, output_hidden_states=True)
        embedding = outputs.hidden_states[-1][0][0].cpu().numpy()
    return embedding

TEXT_VECTOR_DIR = "vector_store/text"
os.makedirs(TEXT_VECTOR_DIR, exist_ok=True)

def save_summary_to_vector_store(client_id: str, summary_text: str):
    embedding = _embed_text(summary_text)
    _save_text_embedding(client_id, embedding, summary_text)

def save_qa_to_vector_store(client_id: str, question: str, answer: str):
    combined = {"question": question, "answer": answer}
    text = f"Q: {question}\nA: {answer}"
    embedding = _embed_text(text)
    _save_text_embedding(client_id, embedding, combined)

def _save_text_embedding(client_id: str, embedding, content):
    index_path = os.path.join(TEXT_VECTOR_DIR, f"{client_id}_index.faiss")
    meta_path = os.path.join(TEXT_VECTOR_DIR, f"{client_id}_meta.pkl")

    if os.path.exists(index_path):
        index = faiss.read_index(index_path)
        with open(meta_path, "rb") as f:
            try:
                metadata = pickle.load(f)
            except Exception:
                metadata = []
    else:
        index = faiss.IndexFlatL2(len(embedding))
        metadata = []

    index.add(embedding.reshape(1, -1))
    metadata.append(content)

    faiss.write_index(index, index_path)
    with open(meta_path, "wb") as f:
        pickle.dump(metadata, f)

def search_from_vector_store(client_id: str, query: str, top_k: int = 3) -> List[str]:
    embedding = _embed_text(query)
    index_path = os.path.join(TEXT_VECTOR_DIR, f"{client_id}_index.faiss")
    meta_path = os.path.join(TEXT_VECTOR_DIR, f"{client_id}_meta.pkl")

    if not os.path.exists(index_path):
        return []

    index = faiss.read_index(index_path)
    with open(meta_path, "rb") as f:
        metadata = pickle.load(f)

    D, I = index.search(embedding.reshape(1, -1), top_k)
    return [metadata[i] for i in I[0] if i < len(metadata)]
