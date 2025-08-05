# runnables/vlm_runnable.py

import base64
import io
from langchain_core.runnables import Runnable
from model.inference import run_inference

# ✅ 이미지 설명용 Runnable 정의 (LangServe용)
def b64_to_bytes_and_infer(b64_string: str):
    image_bytes = base64.b64decode(b64_string)
    return run_inference(image_bytes)["output"]

vlm_runnable: Runnable = Runnable.from_fn(b64_to_bytes_and_infer)