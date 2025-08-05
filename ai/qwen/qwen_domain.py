from transformers import Qwen2_5_VLForConditionalGeneration, AutoProcessor
from pathlib import Path
from datetime import datetime
import torch
import json
import time

# ====== 경로 설정 ======
base_dir = Path(__file__).resolve().parent.parent
# result_path = base_dir / "qwen" / "results_dom.jsonl"
result_path = base_dir / "qwen" / "results_time_infer_only.jsonl"
embedding_dir = base_dir / "qwen" / "cached_embeds"
selected_indices = [80, 82, 30, 41, 50, 13, 44, 53, 18, 19]
# embedding_files = [embedding_dir / f"img_{i:03d}.pt" for i in range(1, 101)]
embedding_files = [embedding_dir / f"img_{i:03d}.pt" for i in selected_indices]

# ====== 저장 함수 ======
def save_result_jsonl(output, infer_time, path=result_path):
    record = {
        "output": output.strip(),
        "infer_time": round(infer_time, 2)
    }
    with open(path, "a", encoding="utf-8") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")

# ====== 분류 프롬프트 ======
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

# ====== 문서 분류 함수 ======
def classify_document(image_inputs, model, processor):
    messages = [
        {"role": "user", "content": [
            {"type": "image", "image": "<cached>"},
            {"type": "text", "text": DOC_TYPE_PROMPT}
        ]}
    ]
    text = processor.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    inputs = processor(text=[text], images=image_inputs, return_tensors="pt").to(model.device)

    with torch.no_grad():
        generated_ids = model.generate(**inputs, max_new_tokens=16)
        trimmed_ids = [out[len(inp):] for inp, out in zip(inputs.input_ids, generated_ids)]
        result = processor.batch_decode(trimmed_ids, skip_special_tokens=True)[0]
    return result.strip()

# ====== 유형별 프롬프트 ======
A_PROMPT = """
    고지서야. 
    참고해서 노인분들 대상으로 요약해줘
"""

    
HEALTH_PROMPT = """
    건강관련 안내문이야. 
    참고해서 노인분들 대상으로 요약해줘
    """

LIFE_PROMPT = """
    생활관련 안내문이야. 
    참고해서 노인분들 대상으로 요약해줘
    """

FINANCE_PROMPT = """
    금융관련 안내문이야. 
    참고해서 노인분들 대상으로 요약해줘
    """
   
# ====== 모델 로드 ======
model = Qwen2_5_VLForConditionalGeneration.from_pretrained(
    "Qwen/Qwen2.5-VL-7B-Instruct",
    torch_dtype=torch.float16,
    device_map="auto"
)
model.eval()
processor = AutoProcessor.from_pretrained("Qwen/Qwen2.5-VL-7B-Instruct")
print(f"모델 디바이스: {model.device if hasattr(model, 'device') else '멀티 디바이스'}")

# ====== 메인 루프 ======
for embed_file in embedding_files:
    if not embed_file.exists():
        print(f"⚠️ 임베딩 파일 없음: {embed_file}")
        continue

    image_inputs = torch.load(embed_file, weights_only=False)
    image_id = embed_file.stem

    doc_label = classify_document(image_inputs, model, processor)
    print(f"[{image_id}] 문서 유형 분류: {doc_label}")

    if doc_label == "고지서":
        prompt_text = A_PROMPT
    elif doc_label == "안내문-건강":
        prompt_text = HEALTH_PROMPT
    elif doc_label == "안내문-생활":
        prompt_text = LIFE_PROMPT
    elif doc_label == "안내문-금융":
        prompt_text = FINANCE_PROMPT
    else:
        print(f"⚠️ 알 수 없는 유형: {doc_label}")
        continue

    messages = [
        {"role": "user", "content": [
            {"type": "image", "image": "<cached>"},
            {"type": "text", "text": prompt_text}
        ]}
    ]
    text = processor.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    inputs = processor(text=[text], images=image_inputs, return_tensors="pt").to(model.device)

    with torch.no_grad():
        infer_start = time.time()
        generated_ids = model.generate(**inputs, max_new_tokens=512)
        infer_end = time.time()
        trimmed_ids = [out[len(inp):] for inp, out in zip(inputs.input_ids, generated_ids)]
        output_text = processor.batch_decode(trimmed_ids, skip_special_tokens=True)[0]

    infer_time = infer_end - infer_start
    print(f"[{image_id}] 추론 완료 ({infer_time:.2f}초)")
    save_result_jsonl(output_text, infer_time)
