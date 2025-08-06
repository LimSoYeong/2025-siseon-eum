# ai/qwen/model_loader.py

from functools import lru_cache
import torch
import gc
import os

# GPU 1번만 사용하도록 설정
os.environ["CUDA_VISIBLE_DEVICES"] = "1" 

gc.collect()
torch.cuda.empty_cache()

from transformers import Qwen2_5_VLForConditionalGeneration, AutoProcessor

@lru_cache()
def get_model():
    model = Qwen2_5_VLForConditionalGeneration.from_pretrained(
        "Qwen/Qwen2.5-VL-7B-Instruct",
        torch_dtype=torch.float16,
        device_map={"": "cuda:0"}  # "cuda:0"은 실제 GPU 1을 의미함
    )
    return model.eval()

@lru_cache()
def get_processor():
    return AutoProcessor.from_pretrained("Qwen/Qwen2.5-VL-7B-Instruct", use_fast=True)