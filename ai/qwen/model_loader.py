# ai/qwen/model_loader.py

from functools import lru_cache
import torch
import gc
import os
from transformers import Qwen2_5_VLForConditionalGeneration, AutoProcessor

# GPU 1번만 사용하도록 설정
os.environ["CUDA_VISIBLE_DEVICES"] = "1"

# 메모리 초기화
gc.collect()
torch.cuda.empty_cache()

@lru_cache()
def get_model():
    model = Qwen2_5_VLForConditionalGeneration.from_pretrained(
        "Qwen/Qwen2.5-VL-7B-Instruct",
        torch_dtype=torch.float16,                  # FP16 사용
        attn_implementation="flash_attention_2",    # ★ FlashAttention-2 활성화
        device_map={"": "cuda:1"}                  
    )
    return model.eval()

@lru_cache()
def get_processor():
    return AutoProcessor.from_pretrained(
        "Qwen/Qwen2.5-VL-7B-Instruct",
        use_fast=True
    )
