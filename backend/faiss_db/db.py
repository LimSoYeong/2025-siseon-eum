import faiss
import pickle
import numpy as np
import os

FAISS_INDEX_PATH = "faiss_db/index.faiss"
FAISS_DATA_PATH = "faiss_db/index.pkl"

class SimpleFaissDB:
    def __init__(self, dim):
        self.dim = dim
        self.index = faiss.IndexFlatL2(dim)
        self.texts = []
        self.metadatas = []

    def add(self, embedding: np.ndarray, text: str, metadata: dict):
        self.index.add(embedding.reshape(1, -1))
        self.texts.append(text)
        self.metadatas.append(metadata)

    def save(self):
        os.makedirs("faiss_db", exist_ok=True)
        faiss.write_index(self.index, FAISS_INDEX_PATH)
        with open(FAISS_DATA_PATH, "wb") as f:
            pickle.dump({"texts": self.texts, "metadatas": self.metadatas}, f)

    def load(self):
        self.index = faiss.read_index(FAISS_INDEX_PATH)
        with open(FAISS_DATA_PATH, "rb") as f:
            data = pickle.load(f)
            self.texts = data["texts"]
            self.metadatas = data["metadatas"]

    def search(self, query_embedding: np.ndarray, k=3):
        D, I = self.index.search(query_embedding.reshape(1, -1), k)
        results = []
        for idx in I[0]:
            results.append({
                "text": self.texts[idx],
                "metadata": self.metadatas[idx]
            })
        return results