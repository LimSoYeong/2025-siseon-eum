# infrastructure/vlm_client.py

from model.inference import run_inference

def extract_text_from_image(image_bytes: bytes) -> str:
    try:
        result = run_inference(image_bytes)
        return result["output"]
    except Exception as e:
        raise RuntimeError(f"[VLM 오류] 문서 이미지 요약 실패: {e}")