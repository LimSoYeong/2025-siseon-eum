import sys
import time
import json
import torch
from pathlib import Path
from PIL import Image

from model_loader import get_model, get_processor

# ====== 경로 설정 ======
base_dir = Path(__file__).resolve().parent.parent
result_path = base_dir / "qwen" / "results_time_infer_only.jsonl"
image_dir = base_dir / "data" / "img"
image_files = sorted(image_dir.glob("*.jpg"))  # 또는 *.png 등

# ====== 저장 함수 ======
def save_result_jsonl(output, infer_time, path=result_path):
    record = {
        "output": output.strip(),
        "infer_time": round(infer_time, 2)
    }
    with open(path, "a", encoding="utf-8") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")

# ====== 분류용 프롬프트 ======
DOC_TYPE_PROMPT = """
다음 문서가 어떤 유형인지 하나만 선택해서 출력하세요.
- 고지서
- 안내문-건강
- 안내문-생활
- 안내문-금융

조건:
- 유형 이름만 정확히 출력하세요 (예: 고지서, 안내문-생활)
- 다른 설명은 출력하지 마세요
"""

# ====== 요약용 프롬프트 (유형별로 변수 따로) ======
A_PROMPT = "고지서야. 참고해서 노인분들 대상으로 요약해줘"
HEALTH_PROMPT = "건강관련 안내문이야. 참고해서 노인분들 대상으로 요약해줘"
LIFE_PROMPT = "생활관련 안내문이야. 참고해서 노인분들 대상으로 요약해줘"
FINANCE_PROMPT = "금융관련 안내문이야. 참고해서 노인분들 대상으로 요약해줘"

# ====== 모델 불러오기 ======
model = get_model().eval()
processor = get_processor()
print(f"✅ 모델 로드 완료 (디바이스: {model.device})")

# ====== 문서 유형 분류 함수 ======
def classify_document(image, model, processor):
    messages = [
        {"role": "user", "content": [
            {"type": "image", "image": image},
            {"type": "text", "text": DOC_TYPE_PROMPT}
        ]}
    ]
    text = processor.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    inputs = processor(text=[text], images=[image], return_tensors="pt").to(model.device)

    with torch.no_grad():
        generated_ids = model.generate(**inputs, max_new_tokens=16)
        trimmed_ids = [out[len(inp):] for inp, out in zip(inputs.input_ids, generated_ids)]
        result = processor.batch_decode(trimmed_ids, skip_special_tokens=True)[0]
    return result.strip()

# ====== 메인 루프 ======
for img_path in image_files:
    image_id = img_path.stem
    try:
        image = Image.open(img_path).convert("RGB")
    except Exception as e:
        print(f"⚠️ 이미지 열기 실패: {img_path} - {e}")
        continue

    print(f"\n🖼️ [{image_id}] 이미지 처리 중...")

    # 1. 문서 유형 분류
    doc_type = classify_document(image, model, processor)
    print(f"🔍 문서 유형: {doc_type}")

    # 2. 프롬프트 선택 (변수로 직접 할당)
    if doc_type == "고지서":
        prompt_text = A_PROMPT
    elif doc_type == "안내문-건강":
        prompt_text = HEALTH_PROMPT
    elif doc_type == "안내문-생활":
        prompt_text = LIFE_PROMPT
    elif doc_type == "안내문-금융":
        prompt_text = FINANCE_PROMPT
    else:
        print(f"⚠️ 알 수 없는 유형: {doc_type}")
        continue

    # 3. 요약용 메시지 구성
    messages = [
        {"role": "user", "content": [
            {"type": "image", "image": image},
            {"type": "text", "text": prompt_text}
        ]}
    ]
    text = processor.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    inputs = processor(text=[text], images=[image], return_tensors="pt").to(model.device)

    # 4. 추론
    with torch.no_grad():
        start = time.time()
        generated_ids = model.generate(**inputs, max_new_tokens=512)
        end = time.time()

        trimmed_ids = [out[len(inp):] for inp, out in zip(inputs.input_ids, generated_ids)]
        output = processor.batch_decode(trimmed_ids, skip_special_tokens=True)[0]

    infer_time = end - start
    print(f"📝 [{image_id}] 요약 완료 ({infer_time:.2f}s)\n→ {output.strip()}")
    save_result_jsonl(output, infer_time)
