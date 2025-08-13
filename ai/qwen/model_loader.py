# ai/qwen/model_loader.py
from functools import lru_cache
import torch, gc, os
from transformers import Qwen2_5_VLForConditionalGeneration, AutoProcessor

# 선택: 환경변수로 제어 (없으면 기본값 사용)
DEFAULT_IMPL = os.environ.get("ATTENTION_IMPL", "flash_attention_2")  # "eager" | "sdpa" | "flash_attention_2"
DEFAULT_DEVICE = os.environ.get("CUDA_VISIBLE_DEVICES", "1")          # "0", "1", ...

os.environ["CUDA_VISIBLE_DEVICES"] = DEFAULT_DEVICE
gc.collect(); torch.cuda.empty_cache()

@lru_cache(maxsize=None)
def get_model(attn_impl: str = DEFAULT_IMPL, device_idx: str = DEFAULT_DEVICE):
    # 주의: lru_cache 키에 attn_impl, device_idx가 포함되어 설정별로 따로 로드되게 함
    kwargs = dict(
        pretrained_model_name_or_path="Qwen/Qwen2.5-VL-7B-Instruct",
        torch_dtype=torch.float16,
        device_map={"": f"cuda:{device_idx}"}
    )
    # attn 구현 선택
    if attn_impl:
        kwargs["attn_implementation"] = attn_impl  # "eager" | "sdpa" | "flash_attention_2"

    model = Qwen2_5_VLForConditionalGeneration.from_pretrained(**kwargs)
    return model.eval()

@lru_cache(maxsize=None)
def get_processor():
    return AutoProcessor.from_pretrained("Qwen/Qwen2.5-VL-7B-Instruct", use_fast=True)
