# backend/model/inference.py
# 요약/설명만 출력되던 때 쓰던 레거시 코드

from PIL import Image
import io
import torch
import time

from langserve_app.model_loader import get_model, get_processor

# 모델과 프로세서 초기화
model = get_model()
processor = get_processor()

def run_inference(image_bytes: bytes, prompt: str = "이 이미지를 노인을 위해 쉽게 설명해줘") -> dict:
    start = time.time()
    # 이미지 로딩
    print("[INFO] 이미지 로딩 시작")
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    print(f"[INFO] 이미지 크기: {image.size}")

    print("[INFO] Chat 템플릿 적용 시작")
    # prompt 메시지 구조 생성
    messages = [
        {"role": "user", "content": [
            {"type": "image", "image": image},
            {"type": "text", "text": prompt}
        ]}
    ]
    text = processor.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    print("[INFO] 템플릿 적용 완료")

    print("[INFO] Processor 입력 생성")
    inputs = processor(
        text=[text],
        images=[image],
        return_tensors="pt"
    ).to(model.device)
    print("[INFO] 입력 생성 완료")

    with torch.no_grad():
        print("[INFO] 모델 추론 시작")
        inference_start = time.time()
        generated_ids = model.generate(
            **inputs,
            max_new_tokens=256,
            do_sample=False
        )
        inference_end = time.time()
        print(f"[INFO] ⌛️ 모델 추론 시간: {round(inference_end - inference_start, 2)}초")

    generated_ids_trimmed = [
        out_ids[len(in_ids):] for in_ids, out_ids in zip(inputs.input_ids, generated_ids)
    ]
    output_text = processor.batch_decode(
        generated_ids_trimmed,
        skip_special_tokens=True,
        clean_up_tokenization_spaces=False
    )[0]
    end = time.time()
    print(f"[INFO] ✅ 생성된 텍스트: {output_text[:50]}...")
    print(f"[INFO] ✅ 총 소요 시간: {round(end - start, 2)}초")
    return {
        "output": output_text,
        "inference_time": round(inference_end - inference_start, 2)
    }