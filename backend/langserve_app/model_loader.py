# ✅ backend/langserve_app/model_loader.py

from functools import lru_cache
import torch
import gc

gc.collect()
torch.cuda.empty_cache()

from transformers import Qwen2_5_VLForConditionalGeneration, AutoProcessor

@lru_cache()
def get_model():
    model = Qwen2_5_VLForConditionalGeneration.from_pretrained(
        "Qwen/Qwen2.5-VL-7B-Instruct",
        torch_dtype=torch.float16,
        device_map="auto"  # 또는 device_map={"": "cuda:0"}로 명시해도 됨
    )
    return model.eval()

@lru_cache()
def get_processor():
    return AutoProcessor.from_pretrained("Qwen/Qwen2.5-VL-7B-Instruct", use_fast=True)