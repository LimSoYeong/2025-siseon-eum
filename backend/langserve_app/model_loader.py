# ✅ backend/langserve_app/model_loader.py

from functools import lru_cache
import os, gc, torch
from transformers import Qwen2_5_VLForConditionalGeneration, AutoProcessor

MODEL_BASE = os.getenv("MODEL_BASE", "Qwen/Qwen2.5-VL-7B-Instruct")
ADAPTER_DIR = os.getenv("ADAPTER_DIR", "backend/outputs/dpo/policy")
os.environ["CUDA_VISIBLE_DEVICES"] = "0"

# peft는 선택적 의존성으로 처리 (없어도 베이스로 기동)
try:
    from peft import PeftModel
    HAVE_PEFT = True
except Exception:
    HAVE_PEFT = False

gc.collect()
if torch.cuda.is_available():
    torch.cuda.empty_cache()

@lru_cache()
def get_model():
    torch.backends.cuda.matmul.allow_tf32 = True

    # 1) 베이스 모델 로드
    base = Qwen2_5_VLForConditionalGeneration.from_pretrained(
        MODEL_BASE,
        torch_dtype=torch.bfloat16,
        attn_implementation="flash_attention_2",
        device_map={"": "cuda:0"},
    )

    # 2) 어댑터 있으면 장착, 없으면 베이스로 폴백
    if HAVE_PEFT and os.path.exists(ADAPTER_DIR):
        try:
            print(f"[model_loader] attaching adapter: {ADAPTER_DIR}")
            model = PeftModel.from_pretrained(base, ADAPTER_DIR, device_map={"": "cuda:0"})
            return model.eval()
        except Exception as e:
            print(f"[WARN] adapter attach failed: {e} -> fallback to base")
            return base.eval()
    else:
        if not HAVE_PEFT:
            print("[WARN] peft not installed -> using base model")
        elif not os.path.exists(ADAPTER_DIR):
            print(f"[WARN] adapter dir not found: {ADAPTER_DIR} -> using base model")
        return base.eval()

@lru_cache()
def get_processor():
    # 베이스와 동일한 프로세서 사용
    return AutoProcessor.from_pretrained(MODEL_BASE, use_fast=True)