# ✅ backend/langserve_app/model_loader.py

from functools import lru_cache
import torch
import gc
import os

# GPU 0번만 사용하도록 설정
os.environ["CUDA_VISIBLE_DEVICES"] = "0"

gc.collect()
torch.cuda.empty_cache()

from transformers import Qwen2_5_VLForConditionalGeneration, AutoProcessor

@lru_cache()
def get_model():
    torch.backends.cuda.matmul.allow_tf32 = True
    model = Qwen2_5_VLForConditionalGeneration.from_pretrained(
        "Qwen/Qwen2.5-VL-7B-Instruct",
        torch_dtype=torch.bfloat16,
        attn_implementation="flash_attention_2",
        device_map={"": "cuda:0"}  # "cuda:0"은 실질적으로 GPU 0 (visible device index 기준)
    )
    return model.eval()

@lru_cache()
def get_processor():
    return AutoProcessor.from_pretrained("Qwen/Qwen2.5-VL-7B-Instruct", use_fast=True)